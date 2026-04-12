'use client';

import { useEffect } from 'react';

/**
 * TranslationHandler leverages Google's translation engine 
 * to automatically translate the entire page if the user's 
 * profile language is not English.
 * 
 * It mimics the 'Translate to [Language]' browser feature.
 */
export default function TranslationHandler({ targetLang }) {
  useEffect(() => {
    // Clear cookies first to force Google Translate to re-process if language changed
    document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=" + window.location.hostname;

    if (!targetLang || targetLang === 'en') return;

    // Map 'he' to 'iw' for Google Translate legacy compatibility
    const googleLang = targetLang === 'he' ? 'iw' : targetLang;

    // Set the cookie for Google Translate (/source/target)
    document.cookie = `googtrans=/en/${googleLang}; path=/;`;
    document.cookie = `googtrans=/en/${googleLang}; path=/; domain=${window.location.hostname};`;
    
    // Check if script is already present
    if (!document.getElementById('google-translate-script')) {
       const script = document.createElement('script');
       script.id = 'google-translate-script';
       script.src = "//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
       script.async = true;
       document.body.appendChild(script);

       window.googleTranslateElementInit = () => {
         new window.google.translate.TranslateElement({
           pageLanguage: 'en',
           autoDisplay: false, // Prevents the sidebar showing up automatically if possible
           layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE
         }, 'google_translate_element');
       };
    }
  }, [targetLang]);

  if (!targetLang || targetLang === 'en') return null;

  return (
    <>
      <div id="google_translate_element" style={{ display: 'none', position: 'absolute', top: '-9999px' }} />
      <style jsx global>{`
        /* Hide Google Translate toolbar and UI artifacts */
        .skiptranslate, 
        .goog-te-banner-frame, 
        #goog-gt-tt, 
        .goog-te-balloon-frame {
          display: none !important;
          visibility: hidden !important;
        }
        
        .goog-te-spinner-pos {
          display: none !important;
        }

        body {
          top: 0 !important;
        }
        
        /* Ensure the app layout isn't pushed down by the missing banner */
        #google_translate_element {
           display: none !important;
        }
        
        .goog-logo-link {
           display: none !important;
        }
        
        .goog-te-gadget {
           color: transparent !important;
           font-size: 0 !important;
        }
      `}</style>
    </>
  );
}
