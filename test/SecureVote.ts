import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { SecureVote, SecureVote__factory } from "../types";
import { expect } from "chai";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("SecureVote")) as SecureVote__factory;
  const secureVote = (await factory.deploy()) as SecureVote;
  const secureVoteAddress = await secureVote.getAddress();
  return { secureVote, secureVoteAddress };
}

describe("SecureVote", function () {
  let signers: Signers;
  let secureVote: SecureVote;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ secureVote } = await deployFixture());
  });

  it("creates a poll and allows encrypted voting", async function () {
    const now = (await ethers.provider.getBlock("latest"))?.timestamp ?? 0;
    const start = now;
    const end = now + 3600;
    const options = ["Alpha", "Beta"];

    const createTx = await secureVote.connect(signers.alice).createPoll("Test Poll", options, start, end);
    await createTx.wait();

    const pollId = Number(await secureVote.pollCount()) - 1;
    const [countsBefore] = await secureVote.getEncryptedCounts(pollId);

    const encryptedChoice = await fhevm
      .createEncryptedInput(await secureVote.getAddress(), signers.bob.address)
      .add8(1)
      .encrypt();

    const voteTx = await secureVote
      .connect(signers.bob)
      .vote(pollId, encryptedChoice.handles[0], encryptedChoice.inputProof);
    await voteTx.wait();

    const [countsAfter] = await secureVote.getEncryptedCounts(pollId);
    const changed =
      countsAfter[0] !== countsBefore[0] ||
      countsAfter[1] !== countsBefore[1] ||
      countsAfter[2] !== countsBefore[2] ||
      countsAfter[3] !== countsBefore[3];
    expect(changed).to.eq(true);

    const hasVoted = await secureVote.hasVoted(pollId, signers.bob.address);
    expect(hasVoted).to.eq(true);
  });

  it("prevents ending a poll before end time and allows ending after", async function () {
    const now = (await ethers.provider.getBlock("latest"))?.timestamp ?? 0;
    const start = now;
    const end = now + 100;

    const createTx = await secureVote.connect(signers.alice).createPoll("Window Poll", ["Yes", "No"], start, end);
    await createTx.wait();

    const pollId = Number(await secureVote.pollCount()) - 1;

    await expect(secureVote.connect(signers.bob).endPoll(pollId)).to.be.revertedWith("Poll still active");

    await ethers.provider.send("evm_setNextBlockTimestamp", [end + 1]);
    await ethers.provider.send("evm_mine", []);

    const endTx = await secureVote.connect(signers.bob).endPoll(pollId);
    await endTx.wait();

    const info = await secureVote.getPollInfo(pollId);
    expect(info[6]).to.eq(true);
  });
});
