import { StreamDataOutput } from "./contract-types/FuelStream";
import { TOKENS } from "./config";
import { bn } from "fuels";
import { useEffect, useState, useMemo } from "react";
import { FuelStream } from "./contract-types";
import { CONTRACT_ID } from "./config";
import { useNetwork, useWallet } from "@fuels/react";
import {
  MdCancel,
  MdPause,
  MdPlayArrow,
  MdDownload,
  MdCheckCircle,
  MdError,
  MdInfo,
  MdClose,
  MdOpenInNew,
} from "react-icons/md";

interface StreamDetailProps {
  stream: StreamDataOutput;
  onBack: () => void;
}

const StreamDetail = ({ stream, onBack }: StreamDetailProps) => {
  const { wallet } = useWallet();
  const { network } = useNetwork();
  const [currentTime, setCurrentTime] = useState<number>(
    Math.floor(Date.now() / 1000)
  );
  const [claimableAmount, setClaimableAmount] = useState<string>("0");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [isResuming, setIsResuming] = useState(false);

  // 添加 Toast 状态
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
    visible: boolean;
    txId?: string;
  } | null>(null);

  // 显示 Toast 的函数
  const showToast = (
    message: string,
    type: "success" | "error" | "info",
    txId?: string
  ) => {
    setToast({ message, type, visible: true, txId });
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  };

  // 检查当前用户是否为 sender
  const isSender = useMemo(() => {
    if (!wallet?.address) return false;
    return (
      stream.sender.Address?.bits.toLowerCase() ===
      wallet.address.toB256().toLowerCase()
    );
  }, [wallet?.address, stream.sender]);

  // 获取代币信息
  const token = TOKENS.find((t) => t.id === stream.asset_id.bits) || {
    symbol: "Unknown",
    decimals: 9,
  };

  // 计算可领取的代币数量
  const calculateClaimableAmount = (now: number) => {
    const startTime = Number(stream.start_time);
    const endTime = Number(stream.end_time);
    const totalAmount = bn(stream.amount);

    if (now < startTime) return "0";
    if (now >= endTime) return formatAmount(stream.amount.toString());

    const totalDuration = endTime - startTime;
    const elapsedDuration = now - startTime;

    const claimable = totalAmount.mul(elapsedDuration).div(totalDuration);

    return formatAmount(claimable.toString());
  };

  // 设置轮询
  useEffect(() => {
    // 如果状态是 Paused，不启动计时器
    if (stream.status.toString() === "Paused") {
      return;
    }

    const timer = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      setCurrentTime(now);
      setClaimableAmount(calculateClaimableAmount(now));
    }, 1000);

    return () => clearInterval(timer);
  }, [stream.status]);

  // 格式化代币金额
  const formatAmount = (amount: string) => {
    return bn(amount).format({
      precision: token.decimals,
      units: token.decimals,
    });
  };

  // 格式化时间
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  // 格式化地址显示
  const truncateAddress = (address: string) => {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleClaim = async () => {
    if (!wallet) return;

    try {
      setIsSubmitting(true);
      const contract = new FuelStream(CONTRACT_ID, wallet);
      const tx = await contract.functions.claim(stream.id).call();
      await tx.waitForResult();
      showToast("Successfully claimed tokens", "success", tx.transactionId);
    } catch (error) {
      console.error("Failed to claim:", error);
      showToast("Failed to claim tokens", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePause = async () => {
    if (!wallet) return;
    try {
      setIsPausing(true);
      const contract = new FuelStream(CONTRACT_ID, wallet);
      const tx = await contract.functions.pause(stream.id).call();
      await tx.waitForResult();
      console.log("Stream paused successfully");
    } catch (error) {
      console.error("Failed to pause stream:", error);
    } finally {
      setIsPausing(false);
    }
  };

  const handleResume = async () => {
    if (!wallet) return;
    try {
      setIsResuming(true);
      const contract = new FuelStream(CONTRACT_ID, wallet);
      const tx = await contract.functions.resume(stream.id).call();
      await tx.waitForResult();
      console.log("Stream resumed successfully");
    } catch (error) {
      console.error("Failed to resume stream:", error);
    } finally {
      setIsResuming(false);
    }
  };

  const handleCancel = async () => {
    if (!wallet) return;
    try {
      setIsCanceling(true);
      const contract = new FuelStream(CONTRACT_ID, wallet);
      const tx = await contract.functions.cancel(stream.id).call();
      await tx.waitForResult();
      console.log("Stream cancelled successfully");
    } catch (error) {
      console.error("Failed to cancel stream:", error);
    } finally {
      setIsCanceling(false);
    }
  };

  // 添加一个辅助函数来检查是否应该显示操作相关内容
  const shouldShowOperations = () => {
    const status = stream.status.toString();
    return status !== "Cancelled" && status !== "Completed";
  };

  // 添加断是否显示 Claim 按钮的函数
  const shouldShowClaimButton = () => {
    const status = stream.status.toString();
    return status !== "Paused" && status !== "Completed";
  };

  // 添加打开区块浏览器的函数
  const openExplorer = (txId: string) => {
    console.log(network?.url);
    if (network?.url.includes("testnet")) {
      window.open(`https://app-testnet.fuel.network/tx/${txId}`, "_blank");
    } else {
      window.open(`https://app.fuel.network/tx/${txId}`, "_blank");
    }
  };

  return (
    <div className="card bg-base-100">
      <div className="card-body">
        <div className="space-y-6">
          {/* Stream ID */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500 min-w-[120px]">Stream ID:</span>
            <span className="font-medium">{stream.id.toString()}</span>
          </div>

          {/* Token Info */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500 min-w-[120px]">Token:</span>
            <span className="font-medium">{token.symbol}</span>
          </div>

          {/* Amount with formatted decimals */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500 min-w-[120px]">Total Amount:</span>
            <span className="font-medium">
              {formatAmount(stream.amount.toString())} {token.symbol}
            </span>
          </div>

          {/* Sender Address */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500 min-w-[120px]">From:</span>
            <span className="font-medium" title={stream.sender.Address?.bits}>
              {truncateAddress(stream.sender.Address?.bits || "")}
            </span>
          </div>

          {/* Time Range */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500 min-w-[120px]">Start Time:</span>
            <span className="font-medium">
              {formatTime(Number(stream.start_time))}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-500 min-w-[120px]">End Time:</span>
            <span className="font-medium">
              {formatTime(Number(stream.end_time))}
            </span>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500 min-w-[120px]">
              Status On Chain:
            </span>
            <span className="font-medium">{stream.status.toString()}</span>
          </div>

          {/* Current Chain Time */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500 min-w-[120px]">Current Time:</span>
            <span className="font-medium">{formatTime(currentTime)}</span>
          </div>

          {/* Claimable Amount - 只在活态下显示 */}
          {shouldShowOperations() && stream.status.toString() !== "Paused" && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="text-2xl font-bold text-primary">
                {claimableAmount} {token.symbol}
              </div>
              <div className="text-sm text-gray-500 mt-2">
                available to claim
              </div>
            </div>
          )}

          {/* Progress Bar - 只在活跃状态下显示 */}
          {shouldShowOperations() && (
            <div className="w-full">
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-primary h-2.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      ((currentTime - Number(stream.start_time)) /
                        (Number(stream.end_time) - Number(stream.start_time))) *
                        100,
                      100
                    )}%`,
                    opacity:
                      stream.status.toString() === "Paused" ? "0.5" : "1",
                  }}
                ></div>
              </div>
            </div>
          )}

          {/* Stream Status Indicator */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500 min-w-[120px]">Stream Status:</span>
            <span
              className={`font-medium ${
                stream.status.toString() === "Cancelled"
                  ? "text-error"
                  : stream.status.toString() === "Paused"
                  ? "text-warning"
                  : currentTime < Number(stream.start_time)
                  ? "text-warning"
                  : currentTime >= Number(stream.end_time)
                  ? "text-success"
                  : "text-primary"
              }`}
            >
              {stream.status.toString() === "Cancelled"
                ? "Cancelled"
                : stream.status.toString() === "Paused"
                ? "Paused"
                : currentTime < Number(stream.start_time)
                ? "Pending"
                : currentTime >= Number(stream.end_time)
                ? "Completed"
                : "Streaming"}
            </span>
          </div>

          {/* Actions Section - 合并所有操作按钮 */}
          <div className="flex justify-center gap-4 pt-6">
            {/* Sender Actions */}
            {shouldShowOperations() && isSender && (
              <>
                <button
                  className={`btn btn-error gap-2 min-w-[160px] ${
                    isCanceling ? "loading" : ""
                  }`}
                  onClick={handleCancel}
                  disabled={isCanceling}
                >
                  <MdCancel className="text-lg" />
                  Cancel Stream
                </button>

                {stream.status.toString() !== "Paused" ? (
                  <button
                    className={`btn btn-warning gap-2 min-w-[160px] ${
                      isPausing ? "loading" : ""
                    }`}
                    onClick={handlePause}
                    disabled={isPausing}
                  >
                    <MdPause className="text-lg" />
                    Pause Stream
                  </button>
                ) : (
                  <button
                    className={`btn btn-success gap-2 min-w-[160px] ${
                      isResuming ? "loading" : ""
                    }`}
                    onClick={handleResume}
                    disabled={isResuming}
                  >
                    <MdPlayArrow className="text-lg" />
                    Resume Stream
                  </button>
                )}
              </>
            )}

            {/* Claim Button */}
            {shouldShowClaimButton() && (
              <button
                className={`btn gap-2 min-w-[160px] ${
                  stream.status.toString() === "Claimed"
                    ? "btn-disabled bg-gray-500 border-gray-500 text-gray-300"
                    : currentTime < Number(stream.start_time)
                    ? "btn-warning"
                    : Number(claimableAmount) === 0
                    ? "btn-disabled"
                    : "btn-success hover:btn-success-focus"
                }`}
                onClick={handleClaim}
                disabled={
                  isSubmitting ||
                  currentTime < Number(stream.start_time) ||
                  Number(claimableAmount) === 0 ||
                  stream.status.toString() === "Claimed"
                }
              >
                {isSubmitting ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  <MdDownload className="text-lg" />
                )}
                {stream.status.toString() === "Claimed"
                  ? "Already Claimed"
                  : currentTime < Number(stream.start_time)
                  ? "Not Started Yet"
                  : Number(claimableAmount) === 0
                  ? "Nothing to Claim"
                  : isSubmitting
                  ? "Claiming..."
                  : "Claim Tokens"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Toast Component - 添加关闭按钮 */}
      {toast && (
        <div className="toast toast-end">
          <div
            className={`alert ${
              toast.type === "success"
                ? "alert-success"
                : toast.type === "error"
                ? "alert-error"
                : "alert-info"
            } pr-2`}
          >
            {/* 状态图标 */}
            {toast.type === "success" ? (
              <MdCheckCircle className="text-xl" />
            ) : toast.type === "error" ? (
              <MdError className="text-xl" />
            ) : (
              <MdInfo className="text-xl" />
            )}
            <span>{toast.message}</span>
            {/* 添加交易链接按钮 */}
            {toast.txId && (
              <button
                className="btn btn-ghost btn-xs"
                onClick={() => openExplorer(toast.txId!)}
                title="View in Explorer"
              >
                <MdOpenInNew className="text-lg" />
              </button>
            )}
            {/* 关闭按钮 */}
            <button
              className="btn btn-ghost btn-xs"
              onClick={() => setToast(null)}
            >
              <MdClose className="text-lg" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StreamDetail;
