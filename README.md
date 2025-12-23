# SecureVote

SecureVote is an encrypted on-chain voting system built on Zama FHEVM. It allows anyone to create polls, cast
privacy-preserving votes, and publish verifiable results after the voting window closes. Votes and tallies remain
encrypted during the poll, and the final cleartext results are published on-chain with a cryptographic proof.

## Overview

SecureVote focuses on one core idea: strong privacy with verifiable outcomes. Voters submit encrypted choices, the
contract maintains encrypted tallies, and only after the end time can the encrypted totals become publicly
decryptable. Once decryption is available, anyone can submit the cleartext results and proof to finalize the poll.

## Problems Solved

- Ballot privacy: individual votes and running tallies are never revealed during the vote.
- Trust minimization: results are derived from encrypted counts and verified on-chain.
- Early influence resistance: no partial results are visible before the poll ends.
- Accountability: results are published with a verifiable decryption proof.
- Permissionless finalization: any participant can end a poll and publish results.

## Key Capabilities

- Create polls with a name, 2-4 options, and a fixed start/end time.
- Cast votes with Zama FHE encrypted inputs.
- Maintain encrypted tallies on-chain throughout the voting window.
- End polls after the end time and make tallies publicly decryptable.
- Publish cleartext results on-chain with a decryption proof.
- Query poll metadata, encrypted counts, and published results.

## End-to-End Flow

1. Create a poll with name, options, start time, and end time.
2. Voters submit encrypted choices; the contract updates encrypted tallies.
3. Once the end time passes, anyone calls `endPoll` to make tallies publicly decryptable.
4. Off-chain decryption produces cleartext totals and a proof.
5. Anyone submits the results and proof to `publishResults` to finalize the poll.

## Advantages

- Privacy by design: encrypted ballots and tallies prevent leakage.
- Verifiable outcomes: results are accepted only with a valid FHEVM decryption proof.
- Simple governance UX: anyone can end and publish results without special permissions.
- Minimal data exposure: only metadata and final results become public.
- Zama FHEVM compatibility: uses standard FHEVM patterns and APIs.

## Tech Stack

- Smart contracts: Solidity 0.8.x with Zama FHEVM (`@fhevm/solidity`)
- Contract tooling: Hardhat, hardhat-deploy, TypeChain
- Languages: TypeScript and Solidity
- Frontend: React + Vite + viem (read) + ethers (write) + RainbowKit
- Relayer integration: Zama relayer SDK for decryption proofs

## Repository Layout

- `contracts/`: Solidity contracts, including `SecureVote.sol`
- `deploy/`: Deployment scripts
- `deployments/`: Network deployment artifacts and ABIs (use Sepolia ABI for frontend)
- `tasks/`: Hardhat tasks for admin/CLI flows
- `test/`: Contract tests
- `frontend/`: React client

## Prerequisites

- Node.js 20+
- npm 7+

## Installation

```bash
npm install
```

## Environment Configuration

Create a `.env` file in the repo root:

```bash
PRIVATE_KEY=your_wallet_private_key
INFURA_API_KEY=your_infura_project_id
ETHERSCAN_API_KEY=optional_etherscan_key
```

Only `PRIVATE_KEY` and `INFURA_API_KEY` are required for Sepolia deployments. Private keys are used directly (no
mnemonic based setup).

## Compile and Test

```bash
npm run compile
npm run test
```

## Local Development Network

```bash
npx hardhat node
npx hardhat deploy --network localhost
```

## Sepolia Deployment

The recommended order is:

1. Run tests and tasks locally.
2. Deploy to Sepolia with your private key.

```bash
npm run deploy:sepolia
npm run verify:sepolia <CONTRACT_ADDRESS>
```

## Hardhat Tasks

Examples (all tasks support `--network`):

```bash
npx hardhat --network sepolia task:address
npx hardhat --network sepolia task:create-poll --name "Best Snack" --options "Tacos,Pizza" --start 1710000000 --end 1710003600
npx hardhat --network sepolia task:vote --poll 0 --choice 1
```

Notes:
- `task:create-poll` expects 2-4 options and a valid time range.
- `task:vote` encrypts the choice using the FHEVM CLI API before submitting.

## Frontend

The frontend lives in `frontend/` and consumes the Sepolia deployment ABI from `deployments/sepolia`.
Read calls use viem and write calls use ethers.

Typical flow:

```bash
cd frontend
npm install
npm run dev
```

## Contract Interfaces

- `createPoll(name, options, start, end)`: creates a new poll.
- `vote(pollId, encryptedChoice, inputProof)`: encrypted vote submission.
- `endPoll(pollId)`: marks the poll as ended and enables public decryption.
- `publishResults(pollId, cleartextValues, decryptionProof)`: verifies and publishes results.
- `getPollInfo`, `getEncryptedCounts`, `getPublishedResults`, `hasVoted`: read APIs.

## Security and Privacy Model

- Encrypted tallies are stored as `euint32` values; the contract never sees cleartext votes.
- `endPoll` toggles public decryption for the encrypted counts only after the poll is over.
- `publishResults` validates the decryption proof with FHEVM before accepting results.
- Poll metadata and final results are public; intermediate tallies are never revealed.

## Operational Notes

- Polls are identified by incremental IDs from `pollCount()`.
- A voter can only vote once per poll.
- Any account can end a poll after the end time.
- Any account can publish results once public decryption is ready.

## Limitations

- Option count is limited to 2-4 choices per poll.
- Voting and decryption depend on FHEVM infrastructure support.
- Result publication requires a valid decryption proof obtained off-chain.

## Roadmap

- Multi-choice and ranked-choice voting support.
- Optional quorum and minimum participation thresholds.
- Improved UX for decryption proof acquisition and status tracking.
- Gas optimizations for large poll counts and high participation.
- On-chain metadata extensions (description, category, and media links).
- Expanded indexing and analytics for public result history.

## License

BSD-3-Clause-Clear. See `LICENSE`.
