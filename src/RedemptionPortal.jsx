import {useEffect, useState} from 'react';
import {createPortal} from 'react-dom';

import RedemptionHistory from './RedemptionHistory';

const ACCESS_TOKEN_KEYS = ['nexa_access_token', 'nexa_token'];

function readAccessToken() {
  for (const key of ACCESS_TOKEN_KEYS) {
    const sessionValue = sessionStorage.getItem(key);
    if (sessionValue) return sessionValue;
    const localValue = localStorage.getItem(key);
    if (localValue) return localValue;
  }
  return '';
}

function findOrCreateHost() {
  const portal = document.querySelector('.portal-content');
  if (!portal) return null;

  const existing = portal.querySelector('[data-nexa-redemption-history]');
  if (existing) return existing;

  const host = document.createElement('div');
  host.dataset.nexaRedemptionHistory = 'true';
  portal.appendChild(host);
  return host;
}

export default function RedemptionPortal() {
  const [mount, setMount] = useState(null);
  const [accessToken, setAccessToken] = useState('');

  useEffect(() => {
    function synchronize() {
      const token = readAccessToken();
      const host = token ? findOrCreateHost() : null;
      setAccessToken(token);
      setMount(host);
    }

    synchronize();
    const observer = new MutationObserver(synchronize);
    observer.observe(document.body, {childList: true, subtree: true});
    window.addEventListener('storage', synchronize);

    return () => {
      observer.disconnect();
      window.removeEventListener('storage', synchronize);
    };
  }, []);

  if (!mount || !accessToken || !mount.isConnected) return null;
  return createPortal(
    <RedemptionHistory accessToken={accessToken} />,
    mount,
  );
}
