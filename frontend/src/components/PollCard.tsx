import { useMemo, useState } from 'react';
import { Contract } from 'ethers';
import { useReadContract } from 'wagmi';
import { CONTRACT_ABI } from '../config/contracts';
import { useEthersSigner } from '../hooks/useEthersSigner';
import '../styles/VotingApp.css';

type PollCardProps = {
  pollId: number;
  contractAddress: string;
  isAddressValid: boolean;
  walletAddress?: `0x${string}`;
  zamaInstance: any;
  zamaLoading: boolean;
};

type DecryptState = {
  counts: number[];
  encodedValues: `0x${string}`;
  proof: `0x${string}`;
};

const formatTimestamp = (value?: bigint) => {
  if (!value) return 'N/A';
  const date = new Date(Number(value) * 1000);
  return date.toLocaleString();
};

export function PollCard({
  pollId,
  contractAddress,
  isAddressValid,
  walletAddress,
  zamaInstance,
  zamaLoading,
}: PollCardProps) {
  const signerPromise = useEthersSigner();
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [isVoting, setIsVoting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [decryptState, setDecryptState] = useState<DecryptState | null>(null);

  const { data: pollInfo, refetch: refetchPollInfo } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'getPollInfo',
    args: [BigInt(pollId)],
    query: { enabled: isAddressValid },
  });

  const { data: hasVotedData, refetch: refetchHasVoted } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'hasVoted',
    args: walletAddress ? [BigInt(pollId), walletAddress] : undefined,
    query: { enabled: isAddressValid && !!walletAddress },
  });

  const { data: publishedResultsData, refetch: refetchPublishedResults } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'getPublishedResults',
    args: [BigInt(pollId)],
    query: { enabled: isAddressValid },
  });

  const { refetch: refetchEncryptedCounts } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'getEncryptedCounts',
    args: [BigInt(pollId)],
    query: { enabled: false },
  });

  const pollData = pollInfo as
    | [string, string[], bigint, bigint, `0x${string}`, boolean, boolean, boolean]
    | undefined;
  const name = pollData?.[0] ?? '';
  const options = pollData?.[1] ?? [];
  const startTime = pollData?.[2];
  const endTime = pollData?.[3];
  const creator = pollData?.[4];
  const publicReady = pollData?.[6] ?? false;

  const publishedResults = publishedResultsData as [readonly bigint[], boolean] | undefined;
  const alreadyPublished = publishedResults?.[1] === true;

  const now = Math.floor(Date.now() / 1000);
  const status = useMemo(() => {
    if (!startTime || !endTime) {
      return 'Unknown';
    }
    const start = Number(startTime);
    const end = Number(endTime);
    if (now < start) return 'Upcoming';
    if (now >= start && now <= end) return 'Live';
    return 'Ended';
  }, [startTime, endTime, now]);

  const hasVoted = hasVotedData === true;
  const canVote = status === 'Live' && !hasVoted;

  const resetFeedback = () => {
    setActionError('');
    setActionSuccess('');
  };

  const handleVote = async () => {
    resetFeedback();
    if (!walletAddress) {
      setActionError('Connect your wallet to vote.');
      return;
    }
    if (!zamaInstance || zamaLoading) {
      setActionError('Encryption service is still loading.');
      return;
    }
    if (selectedOption === null) {
      setActionError('Select an option before voting.');
      return;
    }
    if (!isAddressValid) {
      setActionError('Set a valid contract address to vote.');
      return;
    }

    try {
      setIsVoting(true);
      const signer = await signerPromise;
      if (!signer) {
        setActionError('Wallet signer not available.');
        return;
      }

      const input = zamaInstance.createEncryptedInput(contractAddress, walletAddress);
      input.add8(selectedOption);
      const encrypted = await input.encrypt();

      const contract = new Contract(contractAddress, CONTRACT_ABI, signer);
      const tx = await contract.vote(pollId, encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      setActionSuccess('Vote submitted.');
      refetchHasVoted();
      refetchPollInfo();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to submit vote.');
    } finally {
      setIsVoting(false);
    }
  };

  const handleEndPoll = async () => {
    resetFeedback();
    if (!isAddressValid) {
      setActionError('Set a valid contract address to end the poll.');
      return;
    }

    try {
      setIsEnding(true);
      const signer = await signerPromise;
      if (!signer) {
        setActionError('Wallet signer not available.');
        return;
      }

      const contract = new Contract(contractAddress, CONTRACT_ABI, signer);
      const tx = await contract.endPoll(pollId);
      await tx.wait();
      setActionSuccess('Poll ended. Public decryption is now available.');
      refetchPollInfo();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to end poll.');
    } finally {
      setIsEnding(false);
    }
  };

  const handleDecrypt = async () => {
    resetFeedback();
    if (!zamaInstance || zamaLoading) {
      setActionError('Encryption service is still loading.');
      return;
    }
    if (!isAddressValid) {
      setActionError('Set a valid contract address to decrypt results.');
      return;
    }

    try {
      setIsDecrypting(true);
      const countsResponse = await refetchEncryptedCounts();
      const countsData = countsResponse.data as [readonly string[], bigint] | undefined;

      if (!countsData) {
        setActionError('Unable to load encrypted counts.');
        return;
      }

      const counts = countsData[0];
      const optionsCount = Number(countsData[1]);
      const handles = counts.slice(0, optionsCount);

      const result = await zamaInstance.publicDecrypt(handles);
      const clearCounts = handles.map((handle: string) => {
        const value = result.clearValues[handle];
        return typeof value === 'bigint' ? Number(value) : Number(value ?? 0);
      });

      setDecryptState({
        counts: clearCounts,
        encodedValues: result.abiEncodedClearValues,
        proof: result.decryptionProof,
      });
      setActionSuccess('Results decrypted locally. Ready to publish.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to decrypt results.');
    } finally {
      setIsDecrypting(false);
    }
  };

  const handlePublish = async () => {
    resetFeedback();
    if (!decryptState) {
      setActionError('Decrypt results first.');
      return;
    }
    if (!isAddressValid) {
      setActionError('Set a valid contract address to publish results.');
      return;
    }

    try {
      setIsPublishing(true);
      const signer = await signerPromise;
      if (!signer) {
        setActionError('Wallet signer not available.');
        return;
      }

      const contract = new Contract(contractAddress, CONTRACT_ABI, signer);
      const tx = await contract.publishResults(pollId, decryptState.encodedValues, decryptState.proof);
      await tx.wait();
      setActionSuccess('Results published on-chain.');
      refetchPublishedResults();
      refetchPollInfo();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to publish results.');
    } finally {
      setIsPublishing(false);
    }
  };

  if (!pollData) {
    return (
      <article className="poll-card loading">
        <div className="poll-header">
          <div>
            <p className="poll-title">Loading poll #{pollId}</p>
            <p className="poll-meta">Fetching details...</p>
          </div>
          <span className="status-pill neutral">Loading</span>
        </div>
      </article>
    );
  }

  return (
    <article className="poll-card">
      <div className="poll-header">
        <div>
          <p className="poll-title">{name}</p>
          <p className="poll-meta">
            Poll #{pollId} - Created by {creator?.slice(0, 6)}...{creator?.slice(-4)}
          </p>
        </div>
        <span className={`status-pill ${status === 'Live' ? 'live' : status === 'Ended' ? 'ended' : 'upcoming'}`}>
          {status}
        </span>
      </div>

      <div className="poll-timeline">
        <div>
          <span className="timeline-label">Starts</span>
          <span className="timeline-value">{formatTimestamp(startTime)}</span>
        </div>
        <div>
          <span className="timeline-label">Ends</span>
          <span className="timeline-value">{formatTimestamp(endTime)}</span>
        </div>
      </div>

      <div className="poll-options">
        {options.map((option, index) => (
          <label className={`option-chip ${selectedOption === index ? 'selected' : ''}`} key={`${pollId}-opt-${index}`}>
            <input
              type="radio"
              name={`poll-${pollId}`}
              value={index}
              checked={selectedOption === index}
              onChange={() => setSelectedOption(index)}
              disabled={!canVote}
            />
            {option}
          </label>
        ))}
      </div>

      <div className="poll-actions">
        <button className="primary-button" onClick={handleVote} disabled={!canVote || isVoting}>
          {hasVoted ? 'Already voted' : isVoting ? 'Submitting vote...' : 'Submit encrypted vote'}
        </button>
        <button className="ghost-button" onClick={handleEndPoll} disabled={isEnding || status !== 'Ended' || publicReady}>
          {publicReady ? 'Poll ended' : isEnding ? 'Ending poll...' : 'End poll'}
        </button>
      </div>

      {publicReady && (
        <div className="decrypt-panel">
          <div>
            <p className="decrypt-title">Public decryption</p>
            <p className="decrypt-note">
              Anyone can decrypt counts now. Use the relayer to produce verifiable results.
            </p>
          </div>
          <div className="decrypt-actions">
            <button className="ghost-button" onClick={handleDecrypt} disabled={isDecrypting}>
              {isDecrypting ? 'Decrypting...' : 'Decrypt results'}
            </button>
            <button
              className="primary-button"
              onClick={handlePublish}
              disabled={isPublishing || !decryptState || alreadyPublished}
            >
              {alreadyPublished ? 'Already published' : isPublishing ? 'Publishing...' : 'Publish on-chain'}
            </button>
          </div>
        </div>
      )}

      {decryptState && (
        <div className="results-panel">
          <p className="results-title">Decrypted counts</p>
          <div className="results-grid">
            {options.map((option, index) => (
              <div className="result-item" key={`${pollId}-result-${index}`}>
                <span className="result-label">{option}</span>
                <span className="result-value">{decryptState.counts[index] ?? 0}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {publishedResults?.[1] && (
        <div className="results-panel published">
          <p className="results-title">Published on-chain</p>
          <div className="results-grid">
            {(publishedResults[0] ?? []).map((value, index) => (
              <div className="result-item" key={`${pollId}-published-${index}`}>
                <span className="result-label">{options[index]}</span>
                <span className="result-value">{Number(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(actionError || actionSuccess) && (
        <div className={`action-message ${actionError ? 'error' : 'success'}`}>
          {actionError || actionSuccess}
        </div>
      )}
    </article>
  );
}
