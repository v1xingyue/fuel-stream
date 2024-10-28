import { Command } from "commander";
import dotenv from "dotenv";
import { Address, Provider, Wallet } from "fuels";
import fs from "fs";
import { FuelStreamFactory, FuelStream } from "./contract-types";

dotenv.config({ path: ".env.b" });

const program = new Command();

program
  .version("1.0.0")
  .description("A Fuel Stream CLI Operator")
  .option(
    "--network <type>",
    "specify your network [mainnet, testnet]",
    "testnet"
  );

enum Network {
  MAINNET = "mainnet",
  TESTNET = "testnet",
}

program.command("init").action(() => {
  const options = program.opts();
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
  .option(
    "--asset_id <asset_id>",
    "the asset id",
    "0xf8f8b6283d7fa5b672b530cbb84fcccb4ff8dc40f8176ef4544ddb1f1952ad07"
  )
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

    console.log(
      `transfer tx transactionId`,
      `https://app.fuel.network/tx/${tx.id}`
    );
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

  console.log(`deployed contractId: fuel-strea - ${contractId}`);

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
  console.log(
    `constructor tx transactionId`,
    `https://app.fuel.network/tx/${transactionId}`
  );
});

// 添加 send-stream 子命令
program
  .command("send-stream")
  .option("--to <to>", "the recipient address")
  .option("--amount <amount>", "the amount")
  .option(
    "--asset_id <asset_id>",
    "the asset id",
    "0xf8f8b6283d7fa5b672b530cbb84fcccb4ff8dc40f8176ef4544ddb1f1952ad07"
  )
  .option(
    "--stream <stream_address>",
    "the stream address",
    "0xa63bc0c293d32678975c5c72b0d09e1bb758570e86489301f061bdb9bb3f5275"
  )
  .description("send a stream to the address")
  .action(
    async (params: {
      to: string;
      amount: string;
      asset_id: string;
      stream: string;
    }) => {
      console.table(params);
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
            params.amount,
            1,
            1000,
            1
          )
          .callParams({
            forward: [params.amount, params.asset_id],
          })
          .call();
      await waitForConstruct();
      console.log(
        `create stream transactionId`,
        `https://${
          network === Network.MAINNET ? "mainnet" : "app-testnet"
        }.fuel.network/tx/${transactionId}`
      );
    }
  );

program
  .command("list-stream")
  .option(
    "--stream <stream_address>",
    "the stream address",
    "0xa63bc0c293d32678975c5c72b0d09e1bb758570e86489301f061bdb9bb3f5275"
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
          stream_id: stream.toNumber(),
        };
      })
    );
  });

program
  .command("show-stream")
  .option(
    "--stream <stream_address>",
    "the stream address",
    "0xa63bc0c293d32678975c5c72b0d09e1bb758570e86489301f061bdb9bb3f5275"
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
      interval: result.value.interval.toNumber(),
    });
  });

program.parse(process.argv);
