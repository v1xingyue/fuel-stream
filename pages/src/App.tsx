import { useEffect, useState } from "react";
import {
  useBalance,
  useConnectUI,
  useIsConnected,
  useWallet,
  useDisconnect,
} from "@fuels/react";
import { FuelStream } from "./contract-types";
import {
  MdContentCopy,
  MdSwapVert,
  MdSend,
  MdArrowBack,
  MdRemoveRedEye,
} from "react-icons/md";
import SendStream from "./SendStream";
import { CONTRACT_ID, TOKENS } from "./config";
import { bn } from "fuels";
import { StreamDataOutput } from "./contract-types/FuelStream";
import StreamDetail from "./StreamDetail";

interface TokenBalance {
  assetId: string;
  amount: string;
  symbol: string;
  decimals: number;
}

// 修改地址缩略函数，显示更多内容
const truncateAddress = (address: string) => {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// 添加复制函数
const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
  // 可以选择添加一个提示 toast
};

// 添加时间格式化函数
const formatTime = (timestamp: number) => {
  const date = new Date(timestamp * 1000); // 转换为毫秒
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

export default function App() {
  const [contract, setContract] = useState<FuelStream>();
  const [streams, setStreams] = useState<StreamDataOutput[]>([]);
  const [outgoingStreams, setOutgoingStreams] = useState<StreamDataOutput[]>(
    []
  );
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
  const [selectedStream, setSelectedStream] = useState<StreamDataOutput | null>(
    null
  );

  // 添加新的状态和类型
  type StreamType = "incoming" | "outgoing";
  const [activeTab, setActiveTab] = useState<StreamType>("incoming");

  // 添加加载状态
  const [isLoading, setIsLoading] = useState(false);

  const getDisplayAddress = () => {
    if (!wallet?.address) return "";
    const address = showBech32
      ? wallet.address.toAddress()
      : wallet.address.toB256();
    return truncateAddress(address);
  };

  // 创建加载数据的函数
  const loadStreams = async (type: StreamType) => {
    if (!isConnected || !wallet || !contract) return;

    setIsLoading(true);
    try {
      if (type === "incoming") {
        const { value } = await contract.functions
          .get_incoming_streams({
            Address: {
              bits: wallet.address.toB256(),
            },
          })
          .get();
        setStreams(value);
      } else {
        const { value } = await contract.functions
          .get_outgoing_streams({
            Address: {
              bits: wallet.address.toB256(),
            },
          })
          .get();
        setOutgoingStreams(value);
      }
    } catch (error) {
      console.error(`Failed to fetch ${type} streams:`, error);
    } finally {
      setIsLoading(false);
    }
  };

  // 监听钱包地址变化，重置 Tab 并加载数据
  useEffect(() => {
    if (wallet?.address) {
      setActiveTab("incoming");
      loadStreams("incoming");
    }
  }, [wallet?.address]);

  // 初始化时只设置合约实例
  useEffect(() => {
    if (isConnected && wallet) {
      const streamContract = new FuelStream(CONTRACT_ID, wallet);
      setContract(streamContract);
    }
  }, [isConnected, wallet]);

  // 当合约实例准备好后，加载初始数据（incoming）
  useEffect(() => {
    if (contract) {
      loadStreams("incoming");
    }
  }, [contract]);

  // 处理 Tab 切换
  const handleTabChange = (tab: StreamType) => {
    setActiveTab(tab);
    loadStreams(tab);
  };

  useEffect(() => {
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

    if (isConnected && wallet) {
      fetchBalances();
    }
  }, [isConnected, wallet]);

  const handleCreateStream = async (streamData: {
    recipient: string;
    assetId: string;
    startTime: Date;
    endTime: Date;
    totalAmount: string;
  }) => {
    if (!contract) return;
    console.log("streamData:", streamData);
    try {
      const numberAmount = Number(streamData.totalAmount);
      const tx = await contract.functions
        .create_stream(
          {
            Address: {
              bits: streamData.recipient,
            },
          },
          numberAmount,
          Math.floor(streamData.startTime.getTime() / 1000),
          Math.floor(streamData.endTime.getTime() / 1000)
        )
        .callParams({
          forward: [numberAmount, streamData.assetId],
        })
        .call();
      console.log(tx.transactionId);
      await tx.waitForResult();
    } catch (error) {
      console.error("Failed to create stream:", error);
      throw error;
    }
  };

  const handlePreviewStream = (stream: StreamDataOutput) => {
    setSelectedStream(stream);
  };

  const handleBackToList = () => {
    setSelectedStream(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200">
      <div className="card w-[1200px] min-h-[900px] bg-base-100 shadow-xl">
        {isConnected ? (
          <div className="card-body items-center text-center">
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
                    <div
                      key={token.assetId}
                      className="stat-value text-lg flex items-center gap-2"
                    >
                      <span className="text-left min-w-[180px]">
                        {token.amount}
                      </span>
                      <span className="text-gray-500">${token.symbol}</span>
                    </div>
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
                {showSendStream
                  ? "Send Stream"
                  : selectedStream
                  ? "Stream Detail"
                  : "Stream List"}
              </h3>
              <button
                className="btn btn-primary gap-2"
                onClick={() => {
                  if (selectedStream) {
                    handleBackToList();
                  } else {
                    setShowSendStream(!showSendStream);
                  }
                }}
              >
                {showSendStream || selectedStream ? (
                  <div className="flex items-center gap-2">
                    <MdArrowBack className="text-lg" />
                    <span>Back to List</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <MdSend className="text-lg" />
                    <span>Send Stream</span>
                  </div>
                )}
              </button>
            </div>

            {!showSendStream && !selectedStream && (
              <div className="w-full">
                <div className="flex gap-2 mb-4">
                  <button
                    className={`btn btn-sm ${
                      activeTab === "incoming" ? "btn-primary" : "btn-ghost"
                    }`}
                    onClick={() => handleTabChange("incoming")}
                  >
                    Incoming
                  </button>
                  <button
                    className={`btn btn-sm ${
                      activeTab === "outgoing" ? "btn-primary" : "btn-ghost"
                    }`}
                    onClick={() => handleTabChange("outgoing")}
                  >
                    Outgoing
                  </button>
                </div>

                {isLoading ? (
                  <div className="w-full text-center py-8">
                    <span className="loading loading-spinner loading-md"></span>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="table w-full">
                      <thead>
                        <tr>
                          <th>Stream ID</th>
                          <th>
                            {activeTab === "incoming" ? "Sender" : "Recipient"}
                          </th>
                          <th>Amount</th>
                          <th>Asset ID</th>
                          <th>Start Time</th>
                          <th>End Time</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(activeTab === "incoming" ? streams : outgoingStreams)
                          .length > 0 ? (
                          (activeTab === "incoming"
                            ? streams
                            : outgoingStreams
                          ).map((stream) => (
                            <tr key={stream.id.toString()}>
                              <td>{stream.id.toString()}</td>
                              <td
                                title={
                                  activeTab === "incoming"
                                    ? stream.sender.Address?.bits
                                    : stream.recipient.Address?.bits
                                }
                              >
                                {truncateAddress(
                                  activeTab === "incoming"
                                    ? stream.sender.Address?.bits || ""
                                    : stream.recipient.Address?.bits || ""
                                )}
                              </td>
                              <td>{stream.amount.toString()}</td>
                              <td title={stream.asset_id.bits}>
                                {truncateAddress(stream.asset_id.bits)}
                              </td>
                              <td>{formatTime(Number(stream.start_time))}</td>
                              <td>{formatTime(Number(stream.end_time))}</td>
                              <td>{stream.status.toString()}</td>
                              <td>
                                <button
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => handlePreviewStream(stream)}
                                  title="Preview Stream"
                                >
                                  <MdRemoveRedEye className="text-lg" />
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td
                              colSpan={8}
                              className="text-center py-8 text-gray-500"
                            >
                              <div className="flex flex-col items-center gap-2">
                                <p>No {activeTab} streams found</p>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {showSendStream && (
              <SendStream
                tokens={TOKENS}
                onSubmit={handleCreateStream}
                onCancel={() => setShowSendStream(false)}
              />
            )}

            {selectedStream && (
              <StreamDetail
                stream={selectedStream}
                contract={contract}
                onBack={handleBackToList}
              />
            )}

            {balance && balance.toNumber() === 0 && (
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
            )}
          </div>
        ) : (
          <div className="card-body flex items-center justify-center">
            <div className="text-center">
              <h2 className="card-title text-2xl mb-8 justify-center">
                Fuel Stream
              </h2>
              <button
                className="btn btn-primary btn-lg"
                onClick={() => connect()}
              >
                {isConnecting ? "Connecting..." : "Connect Wallet"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
