import { useMemo, useState } from 'react';
import { isAddress } from 'viem';
import { useAccount, useReadContract } from 'wagmi';
import { Header } from './Header';
import { PollCreator } from './PollCreator';
import { PollCard } from './PollCard';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '../config/contracts';
import { useZamaInstance } from '../hooks/useZamaInstance';
import '../styles/VotingApp.css';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export function VotingApp() {
  const { address } = useAccount();
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();

  const [addressInput, setAddressInput] = useState(CONTRACT_ADDRESS);
  const [activeAddress, setActiveAddress] = useState(CONTRACT_ADDRESS);

  const isValidAddress = isAddress(addressInput) && addressInput.toLowerCase() !== ZERO_ADDRESS;

  const { data: pollCountData, refetch: refetchPollCount } = useReadContract({
    address: activeAddress as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'pollCount',
    query: { enabled: isAddress(activeAddress) && activeAddress.toLowerCase() !== ZERO_ADDRESS },
  });

  const pollCount = Number(pollCountData ?? 0n);
  const pollIds = useMemo(() => Array.from({ length: pollCount }, (_, index) => pollCount - 1 - index), [pollCount]);

  const applyAddress = () => {
    if (isValidAddress) {
      setActiveAddress(addressInput);
    }
  };

  return (
    <div className="voting-app">
      <Header />

      <section className="hero">
        <div className="hero-text">
          <p className="eyebrow">Secure voting</p>
          <h2 className="hero-title">Keep ballots encrypted, reveal outcomes on your terms.</h2>
          <p className="hero-subtitle">
            Launch polls with 2-4 options, accept encrypted votes, and publish results with on-chain verification.
          </p>
        </div>
        <div className="hero-card">
          <p className="hero-card-title">Connected wallet</p>
          <p className="hero-card-value">
            {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Not connected'}
          </p>
          <p className="hero-card-note">
            Zama relayer: {zamaLoading ? 'Initializing...' : zamaError ? 'Unavailable' : 'Ready'}
          </p>
        </div>
      </section>

      <section className="address-panel">
        <div>
          <p className="panel-title">Contract address</p>
          <p className="panel-note">
            Paste the deployed SecureVote address on Sepolia. This app does not use local storage.
          </p>
        </div>
        <div className="address-actions">
          <input
            className="text-input"
            value={addressInput}
            onChange={(event) => setAddressInput(event.target.value)}
            placeholder="0x..."
          />
          <button className="primary-button" onClick={applyAddress} disabled={!isValidAddress}>
            Use address
          </button>
        </div>
        {!isValidAddress && (
          <p className="form-error">Enter a valid non-zero contract address.</p>
        )}
      </section>

      <section className="content-grid">
        <PollCreator
          contractAddress={activeAddress}
          isAddressValid={isAddress(activeAddress) && activeAddress.toLowerCase() !== ZERO_ADDRESS}
          onCreated={refetchPollCount}
        />

        <section className="panel poll-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Live board</p>
              <h2 className="panel-title">Active polls</h2>
            </div>
            <span className="chip">{pollCount} polls</span>
          </div>
          <div className="poll-list">
            {pollIds.length === 0 && (
              <div className="empty-state">
                <p className="empty-title">No polls yet</p>
                <p className="empty-text">Create the first poll to see it listed here.</p>
              </div>
            )}
            {pollIds.map((pollId) => (
              <PollCard
                key={`poll-${pollId}`}
                pollId={pollId}
                contractAddress={activeAddress}
                isAddressValid={isAddress(activeAddress) && activeAddress.toLowerCase() !== ZERO_ADDRESS}
                walletAddress={address}
                zamaInstance={instance}
                zamaLoading={zamaLoading}
              />
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}
