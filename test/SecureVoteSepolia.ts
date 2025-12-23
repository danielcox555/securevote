import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm, deployments } from "hardhat";
import { SecureVote } from "../types";
import { expect } from "chai";

type Signers = {
  alice: HardhatEthersSigner;
};

describe("SecureVoteSepolia", function () {
  let signers: Signers;
  let secureVote: SecureVote;
  let secureVoteAddress: string;
  let step: number;
  let steps: number;

  function progress(message: string) {
    console.log(`${++step}/${steps} ${message}`);
  }

  before(async function () {
    if (fhevm.isMock) {
      console.warn(`This hardhat test suite can only run on Sepolia Testnet`);
      this.skip();
    }

    try {
      const deployment = await deployments.get("SecureVote");
      secureVoteAddress = deployment.address;
      secureVote = await ethers.getContractAt("SecureVote", deployment.address);
    } catch (e) {
      (e as Error).message += ". Call 'npx hardhat deploy --network sepolia'";
      throw e;
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { alice: ethSigners[0] };
  });

  beforeEach(async () => {
    step = 0;
    steps = 0;
  });

  it("creates a poll and submits an encrypted vote", async function () {
    steps = 6;
    this.timeout(4 * 40000);

    const now = (await ethers.provider.getBlock("latest"))?.timestamp ?? 0;
    const start = now;
    const end = now + 600;

    progress("Creating poll...");
    const createTx = await secureVote.connect(signers.alice).createPoll("Sepolia Poll", ["Red", "Blue"], start, end);
    await createTx.wait();

    const pollId = Number(await secureVote.pollCount()) - 1;

    progress("Encrypting choice...");
    await fhevm.initializeCLIApi();
    const encryptedChoice = await fhevm
      .createEncryptedInput(secureVoteAddress, signers.alice.address)
      .add8(0)
      .encrypt();

    progress("Submitting encrypted vote...");
    const voteTx = await secureVote
      .connect(signers.alice)
      .vote(pollId, encryptedChoice.handles[0], encryptedChoice.inputProof);
    await voteTx.wait();

    progress("Verifying vote flag...");
    const hasVoted = await secureVote.hasVoted(pollId, signers.alice.address);
    expect(hasVoted).to.eq(true);
  });
});
