import { useEffect, useState } from "react";
import {
  useBalance,
  useConnectUI,
  useIsConnected,
  useWallet,
  useDisconnect,
} from "@fuels/react";
import { FuelStream } from "./contract-types";
import { MdContentCopy, MdSwapVert, MdSend, MdArrowBack } from "react-icons/md";
import SendStream from "./SendStream";
import { bn } from "fuels";

// REPLACE WITH YOUR CONTRACT ID
const CONTRACT_ID =
  "0x18c64a51d989d0ceb4c3793391fad8abc4d116fc7f0e6378983f3d69452c9dea";

interface Stream {
  stream_id: string;
  sender: string;
  amount: number;
  asset_id: string;
  start_time: string;
  end_time: string;
}

interface TokenBalance {
  assetId: string;
  amount: string;
  symbol: string;
  decimals: number;
}

const TOKENS = [
  {
    id: "0xf8f8b6283d7fa5b672b530cbb84fcccb4ff8dc40f8176ef4544ddb1f1952ad07",
    symbol: "ETH",
    decimals: 9,
  },
  {
    id: "0x819aae0a063cbeae1ab27d3cf81a805f4ce6a0e07cad1241c0d18b462bb20c55",
    symbol: "CREATOR",
    decimals: 9,
  },
];

// 修改地址缩略函数，显示更多内容
const truncateAddress = (address: string) => {
  if (!address) return "";
  return `${address.slice(0, 12)}...${address.slice(-8)}`;
};

// 添加复制函数
const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
  // 可以选择添加一个提示 toast
};

export default function App() {
  const [contract, setContract] = useState<FuelStream>();
  const [streams, setStreams] = useState<Stream[]>([]);
  const { connect, isConnecting } = useConnectUI();
  const { isConnected } = useIsConnected();
  const { wallet } = useWallet();
  const { balance } = useBalance({
    address: wallet?.address.toAddress(),
    assetId: wallet?.provider.getBaseAssetId(),
  });
  const { disconnect } = useDisconnect();
  const [showBech32, setShowBech32] = useState(true);
  const [showSendStream, setShowSendStream] = useState(false);
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([]);

  const getDisplayAddress = () => {
    if (!wallet?.address) return "";
    const address = showBech32
      ? wallet.address.toAddress()
      : wallet.address.toB256();
    return truncateAddress(address);
  };

  const fetchBalances = async () => {
    if (!wallet?.provider || !wallet.address) return;

    try {
      const balances = await wallet.provider.getBalances(wallet.address);
      console.log("balances:", balances);

      const formattedBalances = balances.balances.map((balance) => {
        const token = TOKENS.find((t) => t.id === balance.assetId) || {
          symbol: "Unknown",
          decimals: 9,
        };

        return {
          assetId: balance.assetId,
          amount: bn(balance.amount).format({
            precision: token.decimals,
            units: token.decimals,
          }),
          symbol: token.symbol,
          decimals: token.decimals,
        };
      });

      console.log("formattedBalances:", formattedBalances);
      setTokenBalances(formattedBalances);
    } catch (error) {
      console.error("Failed to fetch balances:", error);
    }
  };

  useEffect(() => {
    async function getInitialStreams() {
      if (isConnected && wallet) {
        const streamContract = new FuelStream(CONTRACT_ID, wallet);
        setContract(streamContract);
      }
    }

    getInitialStreams();
  }, [isConnected, wallet]);

  useEffect(() => {
    if (isConnected && wallet) {
      fetchBalances();
    }
  }, [isConnected, wallet, fetchBalances]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200">
      <div className="card w-[1200px] min-h-[900px] bg-base-100 shadow-xl">
        <div className="card-body items-center text-center">
          {isConnected ? (
            <>
              <div className="flex justify-between w-full mb-6">
                <h2 className="card-title text-2xl">Fuel Stream</h2>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => disconnect()}
                >
                  Disconnect
                </button>
              </div>

              {tokenBalances.length <= 2 ? (
                <div className="stats stats-vertical lg:stats-horizontal shadow w-full mb-8">
                  <div className="stat">
                    {tokenBalances.map((token) => (
                      <>
                        <div className="stat-value text-lg flex items-center gap-2">
                          <span className="text-left min-w-[180px]">
                            {token.amount}
                          </span>
                          <span className="text-gray-500">${token.symbol}</span>
                        </div>
                      </>
                    ))}
                  </div>

                  <div className="stat">
                    <div className="stat-value text-sm flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          {showBech32 ? "Bech32" : "B256"}
                        </span>
                        <button
                          className="btn btn-ghost btn-xs"
                          onClick={() => setShowBech32(!showBech32)}
                        >
                          <MdSwapVert className="text-sm" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        {getDisplayAddress()}
                        <button
                          className="btn btn-ghost btn-xs"
                          onClick={() =>
                            copyToClipboard(
                              showBech32
                                ? wallet?.address.toAddress() || ""
                                : wallet?.address.toB256() || ""
                            )
                          }
                        >
                          <MdContentCopy className="text-sm" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-full mb-8 flex justify-between items-start">
                  <div className="card bg-base-200 shadow-sm">
                    <div className="card-body p-4">
                      <table className="table table-compact w-auto min-w-[200px]">
                        <tbody>
                          {tokenBalances.map((token) => (
                            <tr key={token.assetId} className="hover">
                              <td className="text-sm whitespace-nowrap">
                                {token.amount}
                              </td>
                              <td className="text-sm text-gray-500">
                                {token.symbol}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="card bg-base-200 shadow-sm">
                    <div className="card-body p-4">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-xs text-gray-500">
                          {showBech32 ? "Bech32" : "B256"}:
                        </span>
                        <span>{getDisplayAddress()}</span>
                        <button
                          className="btn btn-ghost btn-xs"
                          onClick={() => setShowBech32(!showBech32)}
                        >
                          <MdSwapVert className="text-sm" />
                        </button>
                        <button
                          className="btn btn-ghost btn-xs"
                          onClick={() =>
                            copyToClipboard(
                              showBech32
                                ? wallet?.address.toAddress() || ""
                                : wallet?.address.toB256() || ""
                            )
                          }
                        >
                          <MdContentCopy className="text-sm" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center w-full mb-4">
                <h3 className="text-lg font-bold">
                  {showSendStream ? "Send Stream" : "Stream List"}
                </h3>
                <button
                  className="btn btn-primary gap-2"
                  onClick={() => setShowSendStream(!showSendStream)}
                >
                  {showSendStream ? (
                    <>
                      <MdArrowBack className="text-lg" />
                      Back to List
                    </>
                  ) : (
                    <>
                      <MdSend className="text-lg" />
                      Send Stream
                    </>
                  )}
                </button>
              </div>

              <div className="w-full">
                {showSendStream ? (
                  <SendStream
                    contract={contract}
                    onSuccess={() => {
                      setShowSendStream(false);
                      // 可以在这里刷新流列表
                    }}
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="table w-full">
                      <thead>
                        <tr>
                          <th>Stream ID</th>
                          <th>Sender</th>
                          <th>Amount</th>
                          <th>Asset ID</th>
                          <th>Start Time</th>
                          <th>End Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {streams.length > 0 ? (
                          streams.map((stream) => (
                            <tr key={stream.stream_id}>
                              <td>{stream.stream_id}</td>
                              <td>{stream.sender}</td>
                              <td>{stream.amount}</td>
                              <td>{stream.asset_id}</td>
                              <td>{stream.start_time}</td>
                              <td>{stream.end_time}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td
                              colSpan={6}
                              className="text-center py-8 text-gray-500"
                            >
                              <div className="flex flex-col items-center gap-2">
                                <p>No streams found</p>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {balance && balance.toNumber() === 0 ? (
                <div className="alert alert-info w-full">
                  <span>
                    Get testnet funds from the{" "}
                    <a
                      className="link link-primary"
                      target="_blank"
                      rel="noopener noreferrer"
                      href={`https://faucet-testnet.fuel.network/?address=${wallet?.address.toAddress()}`}
                    >
                      Fuel Faucet
                    </a>
                  </span>
                </div>
              ) : null}
            </>
          ) : (
            <button
              className="btn btn-primary btn-lg"
              onClick={() => {
                connect();
              }}
            >
              {isConnecting ? "Connecting..." : "Connect Wallet"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
