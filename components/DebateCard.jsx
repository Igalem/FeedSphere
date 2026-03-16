"use client";
import { useState, useEffect } from 'react';

function getOrCreateSessionId() {
  if (typeof window === 'undefined') return null;
  let sid = localStorage.getItem('fs_session_id');
  if (!sid) {
    sid = 'sess_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('fs_session_id', sid);
  }
  return sid;
}

function useCountdown(endsAt) {
  const [remaining, setRemaining] = useState('');
  useEffect(() => {
    const tick = () => {
      if (!endsAt) return;
      const diff = new Date(endsAt) - Date.now();
      if (diff <= 0) { setRemaining('ENDED'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);
  return remaining;
}

export default function DebateCard({ debate, onVote }) {
  const agentA = debate.agent_a;
  const agentB = debate.agent_b;

  const [votesA, setVotesA] = useState(debate.votes_a || 0);
  const [votesB, setVotesB] = useState(debate.votes_b || 0);
  const [votedFor, setVotedFor] = useState(null);
  const [voting, setVoting] = useState(false);

  const [endsAt, setEndsAt] = useState(debate.ends_at);
  const countdown = useCountdown(endsAt);

  useEffect(() => {
    if (!debate.ends_at) {
      const fallback = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      setEndsAt(fallback);
    }
  }, [debate.ends_at]);

  useEffect(() => {
    const stored = localStorage.getItem(`debate_vote_${debate.id}`);
    if (stored) setVotedFor(stored);
  }, [debate.id]);

  const totalVotes = votesA + votesB;
  const pctA = totalVotes > 0 ? Math.round((votesA / totalVotes) * 100) : 50;
  const pctB = 100 - pctA;

  const isEnded = countdown === 'ENDED';
  const winner = isEnded ? (votesA > votesB ? 'a' : votesB > votesA ? 'b' : 'draw') : null;

  const formatVotes = (n) => n >= 1000 ? (n / 1000).toFixed(1) + 'K' : n.toString();

  const handleVote = async (side) => {
    if (votedFor || voting || isEnded) return;
    setVoting(true);
    if (side === 'a') setVotesA(v => v + 1);
    else setVotesB(v => v + 1);
    setVotedFor(side);
    localStorage.setItem(`debate_vote_${debate.id}`, side);

    try {
      const res = await fetch(`/api/debates/${debate.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ side, sessionId: getOrCreateSessionId() }),
      });
      if (res.ok) {
        const data = await res.json();
        setVotesA(data.votes_a);
        setVotesB(data.votes_b);
        if (onVote) onVote(side);
      }
    } catch (err) {
      console.error('Vote failed:', err);
    } finally {
      setVoting(false);
    }
  };

  const isHebrew = (text) => /[\u0590-\u05FF]/.test(text || '');

  if (!agentA || !agentB) return null;

  const colA = agentA.color_hex || '#c084fc';
  const colB = agentB.color_hex || '#6bcbff';
  const voted = !!votedFor;

  return (
    <div className="debate-card-root" style={{
      '--col-a': colA,
      '--col-b': colB,
      '--col-a-transparent': `${colA}55`,
      '--col-b-transparent': `${colB}55`,
      '--col-a-very-transparent': `${colA}18`,
      '--col-b-very-transparent': `${colB}18`,
      '--col-a-border': `${colA}66`,
      '--col-b-border': `${colB}66`,
      '--winner-glow': winner === 'a' ? `${colA}33` : winner === 'b' ? `${colB}33` : 'transparent'
    }}>
      <style>{`
        .debate-card-wrapper {
          margin: 28px auto;
          max-width: 700px;
          width: calc(100% - 48px);
          border-radius: 20px;
          overflow: hidden;
          position: relative;
          animation: fadeSlide 0.4s ease both;
          box-shadow: 0 0 0 1px rgba(255,255,255,0.08);
          background: linear-gradient(160deg, #18162a 0%, #12121a 50%, #1a1228 100%);
        }
        .debate-card-wrapper.ended-draw {
          background: linear-gradient(160deg, #1a1a24 0%, #12121a 50%, #1a1a24 100%);
        }
        .debate-card-wrapper.winner-a {
          background: linear-gradient(160deg, var(--col-a-very-transparent) 0%, #12121a 50%, #1a1228 100%);
        }
        .debate-card-wrapper.winner-b {
          background: linear-gradient(160deg, #18162a 0%, #12121a 50%, var(--col-b-very-transparent) 100%);
        }
        .debate-card-wrapper::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 20px;
          padding: 1px;
          background: linear-gradient(135deg, var(--col-a-transparent), transparent 40%, transparent 60%, var(--col-b-transparent));
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: destination-out;
          mask-composite: exclude;
          pointer-events: none;
        }

        .debate-header-section {
          padding: 18px 20px 14px;
          text-align: center;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          position: relative;
        }
        .debate-badge-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }
        .debate-live-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: linear-gradient(135deg, #ff4d6d, #f1a10d);
          color: #fff;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 2px;
          padding: 5px 14px;
          border-radius: 100px;
          text-transform: uppercase;
          animation: debate-pulse 2s ease-in-out infinite;
        }
        .debate-closed-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.6);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 2px;
          padding: 5px 14px;
          border-radius: 100px;
          text-transform: uppercase;
          border: 1px solid rgba(255,255,255,0.05);
        }
        @keyframes debate-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,77,109,0.4); }
          50% { box-shadow: 0 0 0 6px rgba(255,77,109,0); }
        }
        .debate-timer {
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          color: rgba(255,255,255,0.5);
          letter-spacing: 1px;
          white-space: nowrap;
        }
        .debate-timer span {
          color: #e8ff47;
          font-weight: 700;
        }
        .debate-question-text {
          font-size: 18px;
          font-weight: 700;
          color: #f0f0f8;
          line-height: 1.4;
          max-width: 600px;
          margin: 0 auto 8px;
          letter-spacing: -0.3px;
        }
        .debate-article-link {
          display: inline-block;
          font-size: 11px;
          color: rgba(255,255,255,0.4);
          text-decoration: none;
          font-family: 'JetBrains Mono', monospace;
          letter-spacing: 0.5px;
          transition: color 0.2s;
          max-width: 500px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .debate-article-link:hover { color: rgba(255,255,255,0.75); }

        .debate-body {
          display: grid;
          grid-template-columns: 1fr 100px 1fr;
          gap: 0;
          padding: 20px;
          align-items: stretch;
        }
        @media (max-width: 600px) {
          .debate-body {
            grid-template-columns: 1fr;
            gap: 12px;
          }
          .debate-center-col { order: -1; }
          .debate-agent-col.right { text-align: left; }
          .debate-agent-col.right .agent-header { flex-direction: row; }
          .debate-agent-col.right .agent-quote { text-align: left; }
          .debate-card-wrapper { width: calc(100% - 32px); }
        }

        .debate-agent-col {
          position: relative;
          padding: 14px;
          border-radius: 14px;
          overflow: hidden;
          min-height: 160px;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
          transition: background 0.25s;
          cursor: pointer;
        }
        .debate-agent-col:not(.voted):not(.loser):hover {
          background: rgba(255,255,255,0.03);
        }
        .debate-agent-col.voted-col {
          background: rgba(255,255,255,0.04);
        }
        .debate-watermark {
          position: absolute;
          font-size: 120px;
          font-weight: 900;
          opacity: 0.04;
          line-height: 1;
          pointer-events: none;
          user-select: none;
        }
        .debate-agent-col.left { text-align: left; }
        .debate-agent-col.right { text-align: left; }
        .debate-agent-col.left .debate-watermark { bottom: -10px; right: -10px; }
        .debate-agent-col.right .debate-watermark { bottom: -10px; left: -10px; }

        .agent-header {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .debate-agent-col.right .agent-header { flex-direction: row-reverse; }

        .debate-avatar {
          width: auto;
          min-width: 36px;
          height: 36px;
          padding: 0 6px;
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          flex-shrink: 0;
          border: 2px solid currentColor;
        }
        .debate-agent-name {
          font-size: 13px;
          font-weight: 700;
          color: #fff;
        }
        .debate-agent-topic {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          opacity: 0.8;
        }
        .agent-quote {
          font-size: 13px;
          line-height: 1.65;
          color: #ddd;
          flex: 1;
          font-style: normal;
          position: relative;
          z-index: 1;
        }
        
        /* WINNER UI */
        .winner-crown {
          position: absolute;
          top: -12px;
          right: -12px;
          font-size: 24px;
          filter: drop-shadow(0 0 10px gold);
          z-index: 10;
          animation: winner-float 3s ease-in-out infinite;
        }
        .debate-agent-col.right .winner-crown { right: auto; left: -12px; }
        @keyframes winner-float {
          0%, 100% { transform: translateY(0) rotate(5deg); }
          50% { transform: translateY(-5px) rotate(-5deg); }
        }

        .winner-badge-pro {
          display: flex;
          align-items: center;
          gap: 4px;
          color: #fff;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 1px;
          padding: 4px 10px;
          border-radius: 6px;
          background: linear-gradient(135deg, #ffd700, #ffa500);
          box-shadow: 0 0 15px rgba(255, 215, 0, 0.3);
          margin-top: 4px;
          width: fit-content;
        }
        .debate-agent-col.winner-side {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          box-shadow: 0 0 30px var(--winner-glow, rgba(255,215,0,0.1));
        }
        .debate-agent-col.winner-side::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(45deg, transparent, rgba(255,255,255,0.05), transparent);
          animation: winner-shimmer 2s infinite linear;
          pointer-events: none;
        }
        @keyframes winner-shimmer {
          0% { transform: translateX(-100%) rotate(45deg); }
          100% { transform: translateX(200%) rotate(45deg); }
        }

        .debate-vote-btn {
          padding: 8px 12px;
          border-radius: 10px;
          border: 1px solid currentColor;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          background: transparent;
          letter-spacing: 0.3px;
          position: relative;
          z-index: 1;
        }
        .debate-vote-btn:hover:not(:disabled) { background: rgba(255,255,255,0.1); }
        .debate-vote-btn:disabled { cursor: default; opacity: 0.8; }

        .debate-center-col {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0;
          padding: 4px 0;
        }
        .debate-thumbnail-wrap {
          width: 86px;
          height: 86px;
          border-radius: 12px;
          overflow: hidden;
          position: relative;
          border: 1px solid rgba(255,255,255,0.1);
          box-shadow: 0 4px 20px rgba(0,0,0,0.4);
          flex-shrink: 0;
        }
        .debate-thumbnail-wrap img { width: 100%; height: 100%; object-fit: cover; }
        .debate-thumbnail-placeholder {
          width: 100%; height: 100%; display: grid; place-items: center;
          font-size: 36px; background: linear-gradient(135deg, #1e1e30, #2a1a35);
        }
        .vs-circle {
          width: 32px; height: 32px; border-radius: 50%;
          background: linear-gradient(135deg, #ff4d6d, #c084fc);
          display: grid; place-items: center; font-size: 10px; font-weight: 900;
          color: #fff; letter-spacing: 0.5px; margin-top: -14px;
          border: 2px solid #12121a; box-shadow: 0 2px 12px rgba(192,132,252,0.4);
          z-index: 2; position: relative;
        }

        .debate-footer { padding: 0 20px 20px; }
        .vote-bar-labels { display: flex; align-items: center; margin-bottom: 6px; gap: 4px; }
        .vote-bar-pct {
          font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 700;
          flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .vote-bar-pct.right-label { text-align: right; }
        .vote-bar-center-label {
          font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;
          color: rgba(255,255,255,0.35); flex-shrink: 0; padding: 0 8px; text-align: center;
          white-space: nowrap;
        }
        .debate-vote-bar-track {
          height: 10px; border-radius: 10px; overflow: hidden; display: flex;
          background: rgba(255,255,255,0.06);
        }
        .debate-vote-bar-a { transition: width 0.7s cubic-bezier(0.4,0,0.2,1); border-radius: 10px 0 0 10px; }
        .debate-vote-bar-b { transition: width 0.7s cubic-bezier(0.4,0,0.2,1); border-radius: 0 10px 10px 0; margin-left: auto; }
        .vote-total-line {
          text-align: center; font-size: 11px; color: rgba(255,255,255,0.35);
          margin-top: 7px; font-family: 'JetBrains Mono', monospace;
        }
        .vote-total-line span { color: rgba(255,255,255,0.6); font-weight: 600; }
        .debate-agent-col.loser { opacity: 0.35; filter: grayscale(80%); pointer-events: none; }
        .draw-badge {
          background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.6);
          font-size: 10px; font-weight: 700; padding: 4px 10px; border-radius: 6px;
          text-transform: uppercase; border: 1px solid rgba(255,255,255,0.1);
        }
      `}</style>

      <div className={`debate-card-wrapper ${winner ? `winner-${winner}` : ''} ${isEnded && winner === 'draw' ? 'ended-draw' : ''}`}>
        {/* === HEADER === */}
        <div className="debate-header-section">
          <div className="debate-badge-row">
            {isEnded ? (
              <div key="badge-closed" className="debate-closed-badge" style={{ background: winner === 'draw' ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.05))' }}>
                {winner === 'draw' ? '⚖️ Debate Tied' : '🏆 Result Final'}
              </div>
            ) : (
              <div key="badge-live" className="debate-live-badge">⚔️ Live Debate</div>
            )}
            {countdown && !isEnded && (
              <div key="timer" className="debate-timer">ENDS IN: <span>{countdown}</span></div>
            )}
          </div>
          <div className="debate-question-text" dir={isHebrew(debate.debate_question || debate.topic) ? 'rtl' : 'ltr'}>
            {debate.debate_question || debate.topic}
          </div>
          {debate.article_url && (
            <a
              key="article-link"
              href={debate.article_url}
              target="_blank"
              rel="noopener noreferrer"
              className="debate-article-link"
              onClick={e => e.stopPropagation()}
            >
              📰 {debate.article_title || debate.topic}
            </a>
          )}
        </div>

        {/* === 3-COL BODY === */}
        <div className="debate-body">
          {/* Agent A */}
          <div
            className={`debate-agent-col left ${isEnded && winner !== 'a' && winner !== 'draw' ? 'loser' : ''} ${voted && votedFor === 'a' ? 'voted-col' : ''} ${winner === 'a' ? 'winner-side' : ''}`}
            style={{ color: 'var(--col-a)' }}
            onClick={() => !voted && !isEnded && handleVote('a')}
          >
            {winner === 'a' && <div className="winner-crown">👑</div>}
            <span className="debate-watermark" style={{ color: 'var(--col-a)' }}>&ldquo;</span>
            <div className="agent-header">
              <div className="debate-avatar" style={{ background: 'var(--col-a-very-transparent)', borderColor: 'var(--col-a-transparent)', color: 'var(--col-a)' }}>
                {[...(agentA.emoji || '')].slice(0, 3).join('')}
              </div>
              <div>
                <div className="debate-agent-name">{agentA.name}</div>
                <div className="debate-agent-topic" style={{ color: 'var(--col-a)' }}>{agentA.topic}</div>
                {winner === 'a' && <div className="winner-badge-pro">Winner</div>}
                {winner === 'draw' && <div className="draw-badge">Tied</div>}
              </div>
            </div>
            <p className="agent-quote" dir={isHebrew(debate.argument_a) ? 'rtl' : 'ltr'} style={{ textAlign: isHebrew(debate.argument_a) ? 'right' : 'left' }}>{debate.argument_a}</p>
            {!isEnded && (
              <div className="vote-btn-container" style={{ minHeight: '34px' }}>
                {(!voted || votedFor === 'a') && (
                  <button
                    key="vote-btn-a"
                    className="debate-vote-btn"
                    style={{
                      color: votedFor === 'a' ? '#fff' : 'var(--col-a)',
                      borderColor: 'var(--col-a-border)',
                      background: votedFor === 'a' ? 'var(--col-a-transparent)' : 'transparent',
                      width: '100%'
                    }}
                    onClick={(e) => { e.stopPropagation(); handleVote('a'); }}
                    disabled={voted}
                  >
                    {votedFor === 'a' ? `✓ Voted` : `Vote for ${agentA.name.split(' ')[0]}`}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Center */}
          <div className="debate-center-col">
            <div className="debate-thumbnail-wrap">
              {debate.article_image_url
                ? <img key="debate-img" src={debate.article_image_url} alt="Debate topic" />
                : <div key="debate-img-placeholder" className="debate-thumbnail-placeholder">⚔️</div>
              }
            </div>
            <div className="vs-circle">VS</div>
          </div>

          {/* Agent B */}
          <div
            className={`debate-agent-col right ${isEnded && winner !== 'b' && winner !== 'draw' ? 'loser' : ''} ${voted && votedFor === 'b' ? 'voted-col' : ''} ${winner === 'b' ? 'winner-side' : ''}`}
            style={{ color: 'var(--col-b)' }}
            onClick={() => !voted && !isEnded && handleVote('b')}
          >
            {winner === 'b' && <div className="winner-crown">👑</div>}
            <span className="debate-watermark" style={{ color: 'var(--col-b)', right: 'auto', left: '-10px' }}>&rdquo;</span>
            <div className="agent-header">
              <div className="debate-avatar" style={{ background: 'var(--col-b-very-transparent)', borderColor: 'var(--col-b-transparent)', color: 'var(--col-b)' }}>
                {[...(agentB.emoji || '')].slice(0, 3).join('')}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="debate-agent-name">{agentB.name}</div>
                <div className="debate-agent-topic" style={{ color: 'var(--col-b)' }}>{agentB.topic}</div>
                {winner === 'b' && <div className="winner-badge-pro" style={{ marginLeft: 'auto' }}>Winner</div>}
                {winner === 'draw' && <div className="draw-badge" style={{ marginLeft: 'auto' }}>Tied</div>}
              </div>
            </div>
            <p className="agent-quote" dir={isHebrew(debate.argument_b) ? 'rtl' : 'ltr'} style={{ textAlign: isHebrew(debate.argument_b) ? 'right' : 'left' }}>{debate.argument_b}</p>
            {!isEnded && (
              <div className="vote-btn-container" style={{ minHeight: '34px' }}>
                {(!voted || votedFor === 'b') && (
                  <button
                    key="vote-btn-b"
                    className="debate-vote-btn"
                    style={{
                      color: votedFor === 'b' ? '#fff' : 'var(--col-b)',
                      borderColor: 'var(--col-b-border)',
                      background: votedFor === 'b' ? 'var(--col-b-transparent)' : 'transparent',
                      width: '100%'
                    }}
                    onClick={(e) => { e.stopPropagation(); handleVote('b'); }}
                    disabled={voted}
                  >
                    {votedFor === 'b' ? `✓ Voted` : `Vote for ${agentB.name.split(' ')[0]}`}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* === VOTE BAR === */}
        <div className="debate-footer">
          <div className="vote-bar-labels">
            <span className="vote-bar-pct" style={{ color: 'var(--col-a)' }}>{agentA.name.split(' ')[0]} ({pctA}%)</span>
            <span className="vote-bar-center-label">{isEnded ? 'Final Result' : 'Current Standing'}</span>
            <span className="vote-bar-pct right-label" style={{ color: 'var(--col-b)' }}>({pctB}%) {agentB.name.split(' ')[0]}</span>
          </div>
          <div className="debate-vote-bar-track">
            <div
              className="debate-vote-bar-a"
              style={{
                width: `${pctA}%`,
                background: `linear-gradient(90deg, var(--col-a), var(--col-a-transparent))`,
              }}
            />
            <div
              className="debate-vote-bar-b"
              style={{
                width: `${pctB}%`,
                background: `linear-gradient(90deg, var(--col-b-transparent), var(--col-b))`,
              }}
            />
          </div>
          <div className="vote-total-line">
            TOTAL VOTES: <span>{formatVotes(totalVotes)}</span>
            {totalVotes === 0 && !voted && <span key="first-vote"> · Be the first to vote!</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
