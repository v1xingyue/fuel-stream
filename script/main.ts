import { Command } from "commander";
import dotenv from "dotenv";
import { Address, Provider, Wallet } from "fuels";
import fs from "fs";
import { FuelStreamFactory, FuelStream } from "../pages/src/contract-types";

const default_asset_id =
  "0xe618a5b8e36e4fca469d25c297e0eb4ebcf6e9b121be360de9839f3abd8b4905";

const default_stream_address =
  "0xa87934b9f2ceff160905a487e6d924ed7deb336fd73acac0f2694c7d6f056d17";
dotenv.config({ path: process.env.ENV_FILE });

const transactionLink = (txId: string) => {
  return `https://${
    process.env.NETWORK === Network.MAINNET ? "app" : "app-testnet"
  }.fuel.network/tx/${txId}`;
};

const program = new Command();

program.version("1.0.0").description("A Fuel Stream CLI Operator");

enum Network {
  MAINNET = "mainnet",
  TESTNET = "testnet",
}

program
  .command("init")
  .option("--network <network>", "the network, testnet or mainnet", "testnet")
  .action((options) => {
    const network = options.network;
    console.log(`init command to .env ,network : ${network}`);
    const account = Wallet.generate();
    console.log(`new account address: ${account.address.toB256()}`);
    const privateKey = account.privateKey;
    // 写入 .env 文件
    if (!fs.existsSync(".env")) {
      fs.writeFileSync(".env", `PRIVATE_KEY=${privateKey}\n`);
      fs.appendFileSync(".env", `NETWORK=${network}`);
    } else {
      console.log(".env file already exists");
    }
  });

program.command("info").action(async () => {
  const privateKey = process.env.PRIVATE_KEY;
  const wallet = Wallet.fromPrivateKey(privateKey as string);
  console.log(`wallet address: ${wallet.address.toAddress()}`);
  console.log(`wallet B256 address : ${wallet.address.toB256()}`);
  const network = process.env.NETWORK as Network;
  // https://testnet.fuel.network/v1/graphql
  const provider = await Provider.create(
    `https://${
      network === Network.MAINNET ? "mainnet" : "testnet"
    }.fuel.network/v1/graphql`
  );
  console.log(`provider is : ${provider.toString()}`);

  const balances = await provider.getBalances(wallet.address);
  for (let balance of balances.balances) {
    console.log(`assetId: ${balance.assetId}, amount: ${balance.amount}`);
  }

  if (balances.balances.length == 0) {
    console.log("need faucet : https://faucet-testnet.fuel.network/ ");
    console.log(`faucet address : ${wallet.address.toAddress()}`);
  }
});

program
  .command("transfer")
  .option("--to <to>", "the to address")
  .option("--amount <amount>", "the amount")
  .option("--asset_id <asset_id>", "the asset id", default_asset_id)
  .action(async ({ to, amount, asset_id }) => {
    const privateKey = process.env.PRIVATE_KEY;
    const wallet = Wallet.fromPrivateKey(privateKey as string);
    const network = process.env.NETWORK as Network;
    const provider = await Provider.create(
      `https://${
        network === Network.MAINNET ? "mainnet" : "testnet"
      }.fuel.network/v1/graphql`
    );
    wallet.provider = provider;
    const tx = await wallet.transfer(to, amount, asset_id);
    await tx.waitForResult();

    console.log(`transfer tx transactionId`, transactionLink(tx.id));
  });

program.command("deploy").action(async () => {
  const privateKey = process.env.PRIVATE_KEY;
  const wallet = Wallet.fromPrivateKey(privateKey as string);
  const network = process.env.NETWORK as Network;
  // https://testnet.fuel.network/v1/graphql
  const provider = await Provider.create(
    `https://${
      network === Network.MAINNET ? "mainnet" : "testnet"
    }.fuel.network/v1/graphql`
  );
  console.log(`provider: ${provider}`);
  wallet.provider = provider;
  const { contractId, waitForResult: waitForDeploy } =
    await new FuelStreamFactory(wallet).deploy();

  await waitForDeploy();

  console.log(`deployed contractId: fuel-stream - ${contractId}`);

  const stream = new FuelStream(contractId, wallet);
  const { transactionId, waitForResult: waitForConstruct } =
    await stream.functions
      .constructor({
        Address: {
          bits: wallet.address.toB256(),
        },
      })
      .call();
  await waitForConstruct();
  console.log(`constructor tx transactionId`, transactionLink(transactionId));
});

// 添加 send-stream 子命令
program
  .command("send-stream")
  .option("--to <to>", "the recipient address")
  .option("--step_count <step_count>", "stream step count", "120")
  .option("--unit-amount <unit_amount>", "the unit amount")
  .option("--asset_id <asset_id>", "the asset id", default_asset_id)
  .option(
    "--stream <stream_address>",
    "the stream address",
    default_stream_address
  )
  .description("send a stream to the address")
  .action(
    async (params: {
      to: string;
      unitAmount: string;
      asset_id: string;
      stream: string;
      step_count: string;
    }) => {
      console.table(params);
      const privateKey = process.env.PRIVATE_KEY;
      const wallet = Wallet.fromPrivateKey(privateKey as string);
      const network = process.env.NETWORK as Network;
      const provider = await Provider.create(
        `https://${
          network === Network.MAINNET ? "mainnet" : "testnet"
        }.fuel.network/v1/graphql`
      );
      console.log(`provider: ${provider}`);
      wallet.provider = provider;

      const now = Math.floor(Date.now() / 1000);
      const start_time = now + 30;
      const step_count = Number(params.step_count);
      const end_time = start_time + step_count;
      const amount = Number(params.unitAmount) * step_count;
      console.log(`amount: ${amount}`);

      let to: Address = Address.fromB256(params.to);
      console.log(` you will send stream to: ${to}`);
      const contractId = Address.fromB256(params.stream);
      const stream = new FuelStream(contractId, wallet);
      const { transactionId, waitForResult: waitForConstruct } =
        await stream.functions
          .create_stream(
            {
              Address: {
                bits: params.to,
              },
            },
            amount,
            start_time,
            end_time
          )
          .callParams({
            forward: [amount, params.asset_id],
          })
          .call();
      await waitForConstruct();
      console.log(
        `create stream transactionId`,
        transactionLink(transactionId)
      );
    }
  );

program
  .command("list-stream")
  .option(
    "--stream <stream_address>",
    "the stream address",
    default_stream_address
  )
  .action(async (params: { stream: string }) => {
    const contractId = Address.fromB256(params.stream);
    const privateKey = process.env.PRIVATE_KEY;
    const wallet = Wallet.fromPrivateKey(privateKey as string);
    const network = process.env.NETWORK as Network;
    // https://testnet.fuel.network/v1/graphql
    const provider = await Provider.create(
      `https://${
        network === Network.MAINNET ? "mainnet" : "testnet"
      }.fuel.network/v1/graphql`
    );
    console.log(`provider: ${provider}`);
    wallet.provider = provider;

    const stream = new FuelStream(contractId, wallet);
    const result = await stream.functions
      .get_streams({
        Address: {
          bits: wallet.address.toB256(),
        },
      })
      .get();
    let streams = result.value;
    console.table(
      streams.map((stream) => {
        return {
          id: stream.id.toNumber(),
          // asset_id: stream.asset_id?.bits,
          sender: stream.sender.Address?.bits,
          // recipient: stream.recipient.Address?.bits,
          amount: stream.amount.toNumber(),
          start_time: stream.start_time.toNumber(),
          end_time: stream.end_time.toNumber(),
          status: stream.status,
        };
      })
    );
  });

program
  .command("show-stream")
  .option(
    "--stream <stream_address>",
    "the stream address",
    default_stream_address
  )
  .option("--id <stream_id>", "the stream id")
  .action(async (params: { stream: string; id: string }) => {
    const contractId = Address.fromB256(params.stream);
    const privateKey = process.env.PRIVATE_KEY;
    const wallet = Wallet.fromPrivateKey(privateKey as string);
    const network = process.env.NETWORK as Network;
    // https://testnet.fuel.network/v1/graphql
    const provider = await Provider.create(
      `https://${
        network === Network.MAINNET ? "mainnet" : "testnet"
      }.fuel.network/v1/graphql`
    );
    console.log(`provider: ${provider}`);
    wallet.provider = provider;
    const stream = new FuelStream(contractId, wallet);
    const result = await stream.functions.get_stream(params.id).get();
    console.table({
      asset_id: result.value.asset_id?.bits,
      sender: result.value.sender.Address?.bits,
      recipient: result.value.recipient.Address?.bits,
      amount: result.value.amount.toNumber(),
      start_time: result.value.start_time.toNumber(),
      end_time: result.value.end_time.toNumber(),
      claimed_amount: result.value.claimed_amount.toNumber(),
      claimed_time: result.value.claimed_time.toNumber(),
      status: result.value.status,
      paused_at: result.value.paused_at.toNumber(),
    });
  });

program
  .command("now")
  .option(
    "--stream <stream_address>",
    "the stream address",
    default_stream_address
  )

  .action(async (params: { stream: string }) => {
    const contractId = Address.fromB256(params.stream);
    const privateKey = process.env.PRIVATE_KEY;
    const wallet = Wallet.fromPrivateKey(privateKey as string);
    const network = process.env.NETWORK as Network;
    // https://testnet.fuel.network/v1/graphql
    const provider = await Provider.create(
      `https://${
        network === Network.MAINNET ? "mainnet" : "testnet"
      }.fuel.network/v1/graphql`
    );
    console.log(`provider: ${provider}`);
    wallet.provider = provider;
    const stream = new FuelStream(contractId, provider);
    const result = await stream.functions.now().get();
    console.log(result.value.toNumber());
  });

program
  .command("claim")
  .option(
    "--stream <stream_address>",
    "the stream address",
    default_stream_address
  )
  .option("--id <stream_id>", "the stream id")
  .action(async (params: { stream: string; id: string }) => {
    const contractId = Address.fromB256(params.stream);
    const privateKey = process.env.PRIVATE_KEY;
    const wallet = Wallet.fromPrivateKey(privateKey as string);
    const network = process.env.NETWORK as Network;
    // https://testnet.fuel.network/v1/graphql
    const provider = await Provider.create(
      `https://${
        network === Network.MAINNET ? "mainnet" : "testnet"
      }.fuel.network/v1/graphql`
    );
    console.log(`provider: ${provider}`);
    wallet.provider = provider;
    const stream = new FuelStream(contractId, wallet);
    const { transactionId, waitForResult: waitForClaim } =
      await stream.functions.claim(params.id).call();
    await waitForClaim();
    console.log(`claim transactionId`, transactionLink(transactionId));
  });

program
  .command("pause")
  .option(
    "--stream <stream_address>",
    "the stream address",
    default_stream_address
  )
  .option("--id <stream_id>", "the stream id")
  .action(async (params: { stream: string; id: string }) => {
    const contractId = Address.fromB256(params.stream);
    const privateKey = process.env.PRIVATE_KEY;
    const wallet = Wallet.fromPrivateKey(privateKey as string);
    const network = process.env.NETWORK as Network;
    // https://testnet.fuel.network/v1/graphql
    const provider = await Provider.create(
      `https://${
        network === Network.MAINNET ? "mainnet" : "testnet"
      }.fuel.network/v1/graphql`
    );
    console.log(`provider: ${provider}`);
    wallet.provider = provider;
    const stream = new FuelStream(contractId, wallet);
    const { transactionId, waitForResult: waitForClaim } =
      await stream.functions.pause(params.id).call();
    await waitForClaim();
    console.log(`pause transactionId`, transactionLink(transactionId));
  });

program
  .command("resume")
  .option(
    "--stream <stream_address>",
    "the stream address",
    default_stream_address
  )
  .option("--id <stream_id>", "the stream id")
  .action(async (params: { stream: string; id: string }) => {
    const contractId = Address.fromB256(params.stream);
    const privateKey = process.env.PRIVATE_KEY;
    const wallet = Wallet.fromPrivateKey(privateKey as string);
    const network = process.env.NETWORK as Network;
    // https://testnet.fuel.network/v1/graphql
    const provider = await Provider.create(
      `https://${
        network === Network.MAINNET ? "mainnet" : "testnet"
      }.fuel.network/v1/graphql`
    );
    console.log(`provider: ${provider}`);
    wallet.provider = provider;
    const stream = new FuelStream(contractId, wallet);
    const { transactionId, waitForResult: waitForClaim } =
      await stream.functions.resume(params.id).call();
    await waitForClaim();
    console.log(`resume transactionId`, transactionLink(transactionId));
  });
program
  .command("will-claim")
  .option(
    "--stream <stream_address>",
    "the stream address",
    default_stream_address
  )
  .option("--id <stream_id>", "the stream id")
  .action(async (params: { stream: string; id: string }) => {
    const contractId = Address.fromB256(params.stream);
    const privateKey = process.env.PRIVATE_KEY;
    const wallet = Wallet.fromPrivateKey(privateKey as string);
    const network = process.env.NETWORK as Network;
    // https://testnet.fuel.network/v1/graphql
    const provider = await Provider.create(
      `https://${
        network === Network.MAINNET ? "mainnet" : "testnet"
      }.fuel.network/v1/graphql`
    );
    console.log(`provider: ${provider}`);
    wallet.provider = provider;
    const stream = new FuelStream(contractId, wallet);
    const result = await stream.functions.will_claim(params.id).get();
    console.log("will claim amount: ", result.value[0].toNumber());
    console.log("timestamp: ", result.value[1].toNumber());
  });
program.parse(process.argv);
