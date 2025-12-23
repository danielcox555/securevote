import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

/**
 * Examples:
 *   - npx hardhat --network sepolia task:address
 *   - npx hardhat --network sepolia task:create-poll --name "Best Snack" --options "Tacos,Pizza" --start 1710000000 --end 1710003600
 *   - npx hardhat --network sepolia task:vote --poll 0 --choice 1
 */

task("task:address", "Prints the SecureVote address").setAction(async function (_taskArguments: TaskArguments, hre) {
  const { deployments } = hre;
  const secureVote = await deployments.get("SecureVote");
  console.log("SecureVote address is " + secureVote.address);
});

task("task:create-poll", "Creates a new poll")
  .addParam("name", "Poll name")
  .addParam("options", "Comma separated list of options (2-4)")
  .addParam("start", "Start timestamp (seconds)")
  .addParam("end", "End timestamp (seconds)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const { address } = await deployments.get("SecureVote");
    const signer = (await ethers.getSigners())[0];
    const contract = await ethers.getContractAt("SecureVote", address);

    const options = String(taskArguments.options)
      .split(",")
      .map((option) => option.trim())
      .filter((option) => option.length > 0);

    const start = Number(taskArguments.start);
    const end = Number(taskArguments.end);

    const tx = await contract.connect(signer).createPoll(taskArguments.name, options, start, end);
    console.log(`Wait for tx:${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
  });

task("task:vote", "Votes on a poll using encrypted choice")
  .addParam("poll", "Poll id")
  .addParam("choice", "Option index (0-3)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const { address } = await deployments.get("SecureVote");
    const signers = await ethers.getSigners();
    const contract = await ethers.getContractAt("SecureVote", address);

    const choice = Number(taskArguments.choice);
    if (!Number.isInteger(choice)) {
      throw new Error(`Argument --choice is not an integer`);
    }

    const encryptedChoice = await fhevm
      .createEncryptedInput(address, signers[0].address)
      .add8(choice)
      .encrypt();

    const tx = await contract
      .connect(signers[0])
      .vote(taskArguments.poll, encryptedChoice.handles[0], encryptedChoice.inputProof);

    console.log(`Wait for tx:${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
  });
