import { ConnectButton } from '@rainbow-me/rainbowkit';
import '../styles/Header.css';

export function Header() {
  return (
    <header className="header">
      <div className="header-container">
        <div className="header-content">
          <div className="header-left">
            <div className="brand-block">
              <h1 className="header-title">SecureVote</h1>
              <p className="header-subtitle">Encrypted ballots. Public results.</p>
            </div>
          </div>
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
