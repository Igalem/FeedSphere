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
      const diff = new Date(endsAt) - Date.now();
      if (diff <= 0) { setRemaining('ENDED'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);
  return remaining;
}

export default function DebateCard({ debate }) {
  const agentA = debate.agent_a;
  const agentB = debate.agent_b;

  const [votesA, setVotesA] = useState(debate.votes_a || 0);
  const [votesB, setVotesB] = useState(debate.votes_b || 0);
  const [votedFor, setVotedFor] = useState(null);
  const [voting, setVoting] = useState(false);

  const endsAt = debate.ends_at || new Date(Date.now() + 86400000).toISOString();
  const countdown = useCountdown(endsAt);

  useEffect(() => {
    const stored = localStorage.getItem(`debate_vote_${debate.id}`);
    if (stored) setVotedFor(stored);
  }, [debate.id]);

  const totalVotes = votesA + votesB;
  const pctA = totalVotes > 0 ? Math.round((votesA / totalVotes) * 100) : 50;
  const pctB = 100 - pctA;

  const formatVotes = (n) => n >= 1000 ? (n / 1000).toFixed(1) + 'K' : n.toString();

  const handleVote = async (side) => {
    if (votedFor || voting) return;
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
      }
    } catch (err) {
      console.error('Vote failed:', err);
    } finally {
      setVoting(false);
    }
  };

  if (!agentA || !agentB) return null;

  const colA = agentA.color_hex || '#c084fc';
  const colB = agentB.color_hex || '#6bcbff';
  const voted = !!votedFor;

  return (
    <>
      <style>{`
        .debate-card-wrapper {
          margin: 28px auto;
          max-width: 800px;
          width: calc(100% - 48px);
          border-radius: 20px;
          overflow: hidden;
          position: relative;
          animation: fadeSlide 0.4s ease both;
          box-shadow: 0 0 0 1px rgba(255,255,255,0.08);
          background: linear-gradient(160deg, #18162a 0%, #12121a 50%, #1a1228 100%);
        }
        .debate-card-wrapper::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 20px;
          padding: 1px;
          background: linear-gradient(135deg, ${colA}55, transparent 40%, transparent 60%, ${colB}55);
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: destination-out;
          mask-composite: exclude;
          pointer-events: none;
        }

        /* HEADER */
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

        /* 3-COL BODY */
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

        /* AGENT COLUMNS */
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
        .debate-agent-col:not(.voted):hover {
          background: rgba(255,255,255,0.03);
        }
        .debate-agent-col.voted-col {
          background: rgba(255,255,255,0.04);
        }
        .debate-watermark {
          position: absolute;
          font-size: 120px;
          font-weight: 900;
          color: currentColor;
          opacity: 0.04;
          line-height: 1;
          pointer-events: none;
          user-select: none;
        }
        .debate-agent-col.left { text-align: left; direction: ltr; }
        .debate-agent-col.right { text-align: left; direction: ltr; }
        .debate-agent-col.left .debate-watermark { bottom: -10px; right: -10px; }
        .debate-agent-col.right .debate-watermark { bottom: -10px; left: -10px; }

        .agent-header {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .debate-agent-col.right .agent-header { flex-direction: row-reverse; }

        .debate-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: grid;
          place-items: center;
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
        .debate-agent-col.right .agent-quote { text-align: left; }

        /* VOTE BTN */
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
        .debate-vote-btn:hover:not(:disabled) {
          background: rgba(255,255,255,0.1);
        }
        .debate-vote-btn:disabled { cursor: default; opacity: 0.8; }

        /* CENTER COLUMN */
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
        .debate-thumbnail-wrap img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .debate-thumbnail-placeholder {
          width: 100%;
          height: 100%;
          display: grid;
          place-items: center;
          font-size: 36px;
          background: linear-gradient(135deg, #1e1e30, #2a1a35);
        }
        .vs-circle {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: linear-gradient(135deg, #ff4d6d, #c084fc);
          display: grid;
          place-items: center;
          font-size: 10px;
          font-weight: 900;
          color: #fff;
          letter-spacing: 0.5px;
          margin-top: -14px;
          border: 2px solid #12121a;
          box-shadow: 0 2px 12px rgba(192,132,252,0.4);
          z-index: 2;
          position: relative;
        }

        /* VOTE BAR */
        .debate-footer {
          padding: 0 20px 20px;
        }
        .vote-bar-labels {
          display: flex;
          align-items: center;
          margin-bottom: 6px;
          gap: 4px;
        }
        .vote-bar-pct {
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          font-weight: 700;
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .vote-bar-pct.right-label {
          text-align: right;
        }
        .vote-bar-center-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: rgba(255,255,255,0.35);
          flex-shrink: 0;
          padding: 0 8px;
          text-align: center;
          white-space: nowrap;
        }
        .debate-vote-bar-track {
          height: 10px;
          border-radius: 10px;
          overflow: hidden;
          display: flex;
          background: rgba(255,255,255,0.06);
        }
        .debate-vote-bar-a {
          transition: width 0.7s cubic-bezier(0.4,0,0.2,1);
          border-radius: 10px 0 0 10px;
        }
        .debate-vote-bar-b {
          transition: width 0.7s cubic-bezier(0.4,0,0.2,1);
          border-radius: 0 10px 10px 0;
          margin-left: auto;
        }
        .vote-total-line {
          text-align: center;
          font-size: 11px;
          color: rgba(255,255,255,0.35);
          margin-top: 7px;
          font-family: 'JetBrains Mono', monospace;
        }
        .vote-total-line span {
          color: rgba(255,255,255,0.6);
          font-weight: 600;
        }
        .debate-agent-col.loser {
          opacity: 0.45;
          filter: grayscale(40%);
          pointer-events: none;
        }
      `}</style>

      <div className="debate-card-wrapper">

        {/* === HEADER === */}
        <div className="debate-header-section">
          <div className="debate-badge-row">
            <div className="debate-live-badge">⚔️ Live Debate</div>
            {countdown && countdown !== 'ENDED' && (
              <div className="debate-timer">ENDS IN: <span>{countdown}</span></div>
            )}
          </div>
          <div className="debate-question-text">
            {debate.debate_question || debate.topic}
          </div>
          {debate.article_url && (
            <a
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
            className={`debate-agent-col left ${voted && votedFor !== 'a' ? 'loser' : ''} ${voted && votedFor === 'a' ? 'voted-col' : ''}`}
            style={{ color: colA }}
            onClick={() => !voted && handleVote('a')}
          >
            <span className="debate-watermark" style={{ color: colA }}>&ldquo;</span>
            <div className="agent-header">
              <div className="debate-avatar" style={{ background: `${colA}18`, borderColor: `${colA}55`, color: colA }}>
                {agentA.emoji}
              </div>
              <div>
                <div className="debate-agent-name">{agentA.name}</div>
                <div className="debate-agent-topic" style={{ color: colA }}>{agentA.topic}</div>
              </div>
            </div>
            <p className="agent-quote">{debate.argument_a}</p>
            {(!voted || votedFor === 'a') && (
              <button
                className="debate-vote-btn"
                style={{
                  color: votedFor === 'a' ? '#fff' : colA,
                  borderColor: `${colA}66`,
                  background: votedFor === 'a' ? `${colA}33` : 'transparent',
                }}
                onClick={(e) => { e.stopPropagation(); handleVote('a'); }}
                disabled={voted}
              >
                {votedFor === 'a' ? `✓ Voted` : `Vote for ${agentA.name.split(' ')[0]}`}
              </button>
            )}
          </div>

          {/* Center */}
          <div className="debate-center-col">
            <div className="debate-thumbnail-wrap">
              {debate.article_image_url
                ? <img src={debate.article_image_url} alt="Debate topic" />
                : <div className="debate-thumbnail-placeholder">⚔️</div>
              }
            </div>
            <div className="vs-circle">VS</div>
          </div>

          {/* Agent B */}
          <div
            className={`debate-agent-col right ${voted && votedFor !== 'b' ? 'loser' : ''} ${voted && votedFor === 'b' ? 'voted-col' : ''}`}
            style={{ color: colB }}
            onClick={() => !voted && handleVote('b')}
          >
            <span className="debate-watermark" style={{ color: colB, right: 'auto', left: '-10px' }}>&rdquo;</span>
            <div className="agent-header">
              <div className="debate-avatar" style={{ background: `${colB}18`, borderColor: `${colB}55`, color: colB }}>
                {agentB.emoji}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="debate-agent-name">{agentB.name}</div>
                <div className="debate-agent-topic" style={{ color: colB }}>{agentB.topic}</div>
              </div>
            </div>
            <p className="agent-quote">{debate.argument_b}</p>
            {(!voted || votedFor === 'b') && (
              <button
                className="debate-vote-btn"
                style={{
                  color: votedFor === 'b' ? '#fff' : colB,
                  borderColor: `${colB}66`,
                  background: votedFor === 'b' ? `${colB}33` : 'transparent',
                }}
                onClick={(e) => { e.stopPropagation(); handleVote('b'); }}
                disabled={voted}
              >
                {votedFor === 'b' ? `✓ Voted` : `Vote for ${agentB.name.split(' ')[0]}`}
              </button>
            )}
          </div>
        </div>

        {/* === VOTE BAR === */}
        <div className="debate-footer">
          <div className="vote-bar-labels">
            <span className="vote-bar-pct" style={{ color: colA }}>{agentA.name.split(' ')[0]} ({pctA}%)</span>
            <span className="vote-bar-center-label">Current Standing</span>
            <span className="vote-bar-pct right-label" style={{ color: colB }}>({pctB}%) {agentB.name.split(' ')[0]}</span>
          </div>
          <div className="debate-vote-bar-track">
            <div
              className="debate-vote-bar-a"
              style={{
                width: `${pctA}%`,
                background: `linear-gradient(90deg, ${colA}, ${colA}cc)`,
              }}
            />
            <div
              className="debate-vote-bar-b"
              style={{
                width: `${pctB}%`,
                background: `linear-gradient(90deg, ${colB}cc, ${colB})`,
              }}
            />
          </div>
          <div className="vote-total-line">
            TOTAL VOTES: <span>{formatVotes(totalVotes)}</span>
            {totalVotes === 0 && !voted && ' · Be the first to vote!'}
          </div>
        </div>
      </div>
    </>
  );
}
