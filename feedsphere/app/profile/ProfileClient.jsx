'use client';

import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

const TRANSLATIONS = {
  en: {
    title: "My Profile",
    subtitle: "Manage your sphere presence and preferences",
    personal: "Personal Information",
    preferences: "Sphere Preferences",
    security: "Account & Security",
    username: "Username",
    email: "Email Address",
    lang: "Website Language",
    cred: "Cred Score",
    save: "Save Changes",
    saving: "Saving...",
    logout: "Sign Out",
    success: "Profile updated successfully!",
    clickToUpload: "Click to change picture"
  },
  es: {
    title: "Mi Perfil",
    subtitle: "Gestiona tu presencia y preferencias",
    personal: "Información Personal",
    preferences: "Preferencias de la Esfera",
    security: "Cuenta y Seguridad",
    username: "Nombre de usuario",
    email: "Correo electrónico",
    lang: "Idioma del sitio",
    cred: "Puntaje de Crédito",
    save: "Guardar Cambios",
    saving: "Guardando...",
    success: "¡Perfil actualizado con éxito!",
    logout: "Cerrar Sesión",
    clickToUpload: "Clic para cambiar imagen"
  },
  fr: {
    title: "Mon Profil",
    subtitle: "Gérez votre présence et vos préférences",
    personal: "Informations Personnelles",
    preferences: "Préférences de la Sphère",
    security: "Compte et Sécurité",
    username: "Nom d'utilisateur",
    email: "Adresse Email",
    lang: "Langue du site",
    cred: "Score de Crédit",
    save: "Enregistrer",
    saving: "Enregistrement...",
    success: "Profil mis à jour !",
    logout: "Se Déconnecter",
    clickToUpload: "Cliquer pour changer l'image"
  },
  he: {
     title: "הפרופיל שלי",
     subtitle: "נהל את הנוכחות וההעדפות שלך",
     personal: "מידע אישי",
     preferences: "העדפות מערכת",
     security: "חשבון ואבטחה",
     username: "שם משתמש",
     email: "כתובת אימייל",
     lang: "שפת אתר",
     cred: "ניקוד אמינות",
     save: "שמור שינויים",
     saving: "שומר...",
     success: "הפרופיל עודכן בהצלחה!",
     logout: "התנתק",
     clickToUpload: "לחץ לשינוי תמונה"
  }
};

export default function ProfileClient({ initialUser, initialProfile }) {
  const [profile, setProfile] = useState(initialProfile);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const fileInputRef = useRef(null);
  
  const router = useRouter();
  const supabase = createClient();
  
  const lang = profile.app_language || 'en';
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
  const isRTL = lang === 'he';

  const handleChange = (e) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    const { error } = await supabase
      .from('users')
      .update({
        username: profile.username,
        app_language: profile.app_language,
      })
      .eq('id', initialUser.id);

    if (error) {
      setError(error.message);
    } else {
      setMessage(t.success);
      setTimeout(() => setMessage(null), 3000);
      router.refresh(); // Refresh to update any layout headers if needed
      
      // Delay reload slightly to let router.refresh finish
      setTimeout(() => {
         window.location.reload();
      }, 500);
    }
    setSaving(false);
  };

  const uploadAvatar = async (event) => {
    try {
      setUploading(true);
      setError(null);

      if (!event.target.files || event.target.files.length === 0) return;

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const filePath = `${initialUser.id}/${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const avatar_url = data.publicUrl;

      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url })
        .eq('id', initialUser.id);

      if (updateError) throw updateError;
      
      setProfile({ ...profile, avatar_url });
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <div className={`profile-premium-wrapper ${isRTL ? 'rtl' : ''}`} translate="no">
      <div className="profile-hero-bg" />
      
      <div className="profile-content-container">
        {/* Header Section */}
        <header className="profile-main-header">
          <div className="profile-avatar-stack">
            <div className="profile-avatar-wrapper" onClick={() => fileInputRef.current?.click()}>
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="Profile" className="main-avatar-img" />
              ) : (
                <div className="default-avatar-icon">👤</div>
              )}
              <div className="avatar-edit-overlay">
                <span className="edit-pencil-icon">✏️</span>
              </div>
              {uploading && <div className="avatar-upload-spinner" />}
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              accept="image/*" 
              onChange={uploadAvatar} 
            />
            <div className="profile-user-ident">
               <h1 className="profile-display-name">{profile.username || 'Citizen'}</h1>
               <div className="profile-cred-badge">
                 <span className="cred-label">{t.cred}:</span>
                 <span className="cred-value">{profile.cred_score || 0}</span>
               </div>
            </div>
          </div>
        </header>

        {error && <div className="profile-status-alert error">{error}</div>}
        {message && <div className="profile-status-alert success">{message}</div>}

        <div className="profile-grid">
          {/* Main Controls */}
          <form onSubmit={handleSave} className="profile-form-sections">
            
            {/* Category: Personal */}
            <section className="profile-section-card">
              <div className="section-header">
                <span className="section-icon">👤</span>
                <h3>{t.personal}</h3>
              </div>
              <div className="section-content">
                <div className="pro-field">
                  <label>{t.username}</label>
                  <input 
                    name="username"
                    value={profile.username || ''}
                    onChange={handleChange}
                    placeholder="E.g. DigitalVoyager"
                  />
                </div>
                <div className="pro-field">
                  <label>{t.email}</label>
                  <input value={initialUser.email} disabled className="disabled-field" />
                  <span className="field-hint">Email cannot be changed currently</span>
                </div>
              </div>
            </section>

            {/* Category: Preferences */}
            <section className="profile-section-card">
              <div className="section-header">
                <span className="section-icon">🌐</span>
                <h3>{t.preferences}</h3>
              </div>
              <div className="section-content">
                <div className="pro-field">
                  <label>{t.lang}</label>
                  <select name="app_language" value={profile.app_language || 'en'} onChange={handleChange}>
                    <option value="en">English (US)</option>
                    <option value="es">Español</option>
                    <option value="fr">Français</option>
                    <option value="de">Deutsch</option>
                    <option value="he">עברית (Hebrew)</option>
                  </select>
                </div>
              </div>
            </section>

            <div className="profile-actions-row">
              <button type="submit" className="pro-save-btn" disabled={saving || uploading}>
                {saving ? t.saving : t.save}
              </button>
            </div>
          </form>

          {/* Sidebar / Secondary Controls */}
          <aside className="profile-side-rail">
            <section className="profile-section-card ghost">
               <div className="section-header">
                <span className="section-icon">🔒</span>
                <h3>{t.security}</h3>
              </div>
              <p className="side-note">Secure your account by signing out of all sessions.</p>
              <button onClick={handleLogout} className="pro-logout-btn">
                {t.logout}
              </button>
            </section>
          </aside>
        </div>
      </div>

      <style jsx>{`
        .profile-premium-wrapper {
          min-height: 100vh;
          position: relative;
          color: var(--text);
          font-family: 'DM Sans', sans-serif;
          padding-top: 60px;
          padding-bottom: 120px;
        }

        .profile-hero-bg {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 300px;
          background: linear-gradient(to bottom, rgba(234, 255, 4, 0.05), transparent);
          pointer-events: none;
        }

        .profile-content-container {
          max-width: 1050px;
          margin: 0 auto;
          padding: 0 40px;
          position: relative;
          z-index: 2;
        }

        /* RTL override */
        .rtl { direction: rtl; text-align: right; }

        .profile-main-header {
          margin-bottom: 48px;
        }

        .profile-avatar-stack {
          display: flex;
          align-items: flex-end;
          gap: 28px;
        }

        .profile-avatar-wrapper {
          width: 120px;
          height: 120px;
          border-radius: 32px;
          background: var(--surface2);
          border: 2px solid var(--border);
          position: relative;
          cursor: pointer;
          overflow: hidden;
          box-shadow: 0 20px 40px rgba(0,0,0,0.3);
          transition: transform 0.3s ease;
        }

        .profile-avatar-wrapper:hover {
          transform: translateY(-5px);
          border-color: var(--accent);
        }

        .main-avatar-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .default-avatar-icon {
          width: 100%;
          height: 100%;
          display: grid;
          place-items: center;
          font-size: 50px;
        }

        .avatar-edit-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0,0,0,0.4);
          display: grid;
          place-items: center;
          opacity: 0;
          transition: opacity 0.2s;
        }

        .profile-avatar-wrapper:hover .avatar-edit-overlay {
          opacity: 1;
        }

        .edit-pencil-icon {
          font-size: 24px;
        }

        .profile-display-name {
          font-size: 42px;
          font-weight: 800;
          margin: 0 0 8px 0;
          font-family: 'Playfair Display', serif;
        }

        .profile-cred-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(234, 255, 4, 0.1);
          padding: 6px 14px;
          border-radius: 12px;
          border: 1px solid rgba(234, 255, 4, 0.2);
        }

        .cred-label { font-size: 13px; color: var(--muted); }
        .cred-value { font-weight: 800; color: var(--accent); font-family: 'JetBrains Mono', monospace; }

        .profile-grid {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 40px;
          align-items: start;
        }

        @media (max-width: 900px) {
          .profile-grid { grid-template-columns: 1fr; }
          .profile-avatar-stack { flex-direction: column; align-items: center; text-align: center; }
        }

        .profile-section-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 24px;
          padding: 32px;
          margin-bottom: 24px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }

        .profile-section-card.ghost {
          background: transparent;
          border-style: dashed;
        }

        .section-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 28px;
        }

        .section-icon { font-size: 20px; }
        .section-header h3 {
          font-size: 18px;
          font-weight: 700;
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .pro-field {
          margin-bottom: 20px;
        }

        .pro-field label {
          display: block;
          font-size: 13px;
          font-weight: 700;
          color: var(--muted);
          margin-bottom: 10px;
        }

        .pro-field input, .pro-field select {
          width: 100%;
          padding: 12px 18px;
          background: var(--surface2);
          border: 1px solid var(--border2);
          border-radius: 14px;
          color: var(--text);
          font-size: 15px;
          transition: border-color 0.2s;
        }

        .pro-field input:focus {
          border-color: var(--accent);
          outline: none;
        }

        .disabled-field {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .field-hint {
          display: block;
          font-size: 11px;
          color: var(--muted);
          margin-top: 6px;
        }

        .pro-save-btn {
          width: 100%;
          padding: 16px;
          background: var(--accent);
          color: #000;
          border: none;
          border-radius: 16px;
          font-size: 16px;
          font-weight: 800;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .pro-save-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(234, 255, 4, 0.2);
        }

        .pro-logout-btn {
          width: 100%;
          padding: 12px;
          background: transparent;
          color: #ff6b6b;
          border: 1.5px solid #ff6b6b;
          border-radius: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.2s;
        }

        .pro-logout-btn:hover {
          background: rgba(255,107,107,0.1);
        }

        .side-note {
          font-size: 13px;
          color: var(--muted);
          margin-bottom: 20px;
          line-height: 1.5;
        }

        .profile-status-alert {
          padding: 16px 24px;
          border-radius: 16px;
          margin-bottom: 32px;
          font-weight: 600;
        }

        .profile-status-alert.error { background: rgba(255,107,107,0.1); color: #ff6b6b; border: 1px solid rgba(255,107,107,0.2); }
        .profile-status-alert.success { background: rgba(74,222,128,0.1); color: #4ade80; border: 1px solid rgba(74,222,128,0.2); }

        .avatar-upload-spinner {
          position: absolute;
          inset: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .avatar-upload-spinner::after {
          content: "";
          width: 20px;
          height: 20px;
          border: 2px solid #fff;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
