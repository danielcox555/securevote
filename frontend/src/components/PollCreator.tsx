import { useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { Contract } from 'ethers';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { CONTRACT_ABI } from '../config/contracts';
import '../styles/VotingApp.css';

type PollCreatorProps = {
  contractAddress: string;
  isAddressValid: boolean;
  onCreated: () => void | Promise<unknown>;
};

const pad = (value: number) => String(value).padStart(2, '0');

const formatDateTimeLocal = (date: Date) => {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export function PollCreator({ contractAddress, isAddressValid, onCreated }: PollCreatorProps) {
  const { address } = useAccount();
  const signerPromise = useEthersSigner();

  const [name, setName] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [startTime, setStartTime] = useState(() => formatDateTimeLocal(new Date()));
  const [endTime, setEndTime] = useState(() => formatDateTimeLocal(new Date(Date.now() + 60 * 60 * 1000)));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const canAddOption = options.length < 4;
  const canRemoveOption = options.length > 2;

  const trimmedOptions = useMemo(() => options.map((option) => option.trim()), [options]);

  const updateOption = (index: number, value: string) => {
    setOptions((prev) => prev.map((option, i) => (i === index ? value : option)));
  };

  const addOption = () => {
    if (canAddOption) {
      setOptions((prev) => [...prev, '']);
    }
  };

  const removeOption = (index: number) => {
    if (canRemoveOption) {
      setOptions((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!isAddressValid) {
      setError('Set a valid contract address before creating a poll.');
      return;
    }

    if (!address) {
      setError('Connect your wallet to create a poll.');
      return;
    }

    if (name.trim().length === 0) {
      setError('Poll name is required.');
      return;
    }

    if (trimmedOptions.length < 2 || trimmedOptions.length > 4) {
      setError('Provide between 2 and 4 options.');
      return;
    }

    if (trimmedOptions.some((option) => option.length === 0)) {
      setError('Every option needs a label.');
      return;
    }

    const startSeconds = Math.floor(new Date(startTime).getTime() / 1000);
    const endSeconds = Math.floor(new Date(endTime).getTime() / 1000);

    if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds)) {
      setError('Start and end time are required.');
      return;
    }

    if (endSeconds <= startSeconds) {
      setError('End time must be after the start time.');
      return;
    }

    try {
      setIsSubmitting(true);
      const signer = await signerPromise;
      if (!signer) {
        setError('Wallet signer not available.');
        return;
      }

      const contract = new Contract(contractAddress, CONTRACT_ABI, signer);
      const tx = await contract.createPoll(name.trim(), trimmedOptions, startSeconds, endSeconds);
      await tx.wait();

      setSuccess('Poll created successfully.');
      setName('');
      setOptions(['', '']);
      setStartTime(formatDateTimeLocal(new Date()));
      setEndTime(formatDateTimeLocal(new Date(Date.now() + 60 * 60 * 1000)));
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create poll.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Create</p>
          <h2 className="panel-title">Launch a confidential poll</h2>
        </div>
        <span className="chip">2-4 options</span>
      </div>

      <form className="form" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field-label">Poll name</span>
          <input
            className="text-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Team lunch location"
            maxLength={80}
          />
        </label>

        <div className="field">
          <span className="field-label">Options</span>
          <div className="option-stack">
            {options.map((option, index) => (
              <div className="option-row" key={`option-${index}`}>
                <input
                  className="text-input"
                  value={option}
                  onChange={(event) => updateOption(index, event.target.value)}
                  placeholder={`Option ${index + 1}`}
                />
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => removeOption(index)}
                  disabled={!canRemoveOption}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="ghost-button add-option" onClick={addOption} disabled={!canAddOption}>
            Add option
          </button>
        </div>

        <div className="field-grid">
          <label className="field">
            <span className="field-label">Start time</span>
            <input
              type="datetime-local"
              className="text-input"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">End time</span>
            <input
              type="datetime-local"
              className="text-input"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
            />
          </label>
        </div>

        {error && <p className="form-error">{error}</p>}
        {success && <p className="form-success">{success}</p>}

        <button type="submit" className="primary-button" disabled={isSubmitting}>
          {isSubmitting ? 'Creating poll...' : 'Create poll'}
        </button>
        <p className="helper-text">
          Your poll metadata is public, but every vote stays encrypted until you end the poll.
        </p>
      </form>
    </section>
  );
}
