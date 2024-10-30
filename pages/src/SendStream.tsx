import { useState, useEffect, useRef } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { bn, CoinQuantity } from "fuels";
import { useWallet } from "@fuels/react";
import { TOKENS } from "./config";

interface SendStreamProps {
  onSuccess: () => void;
  onSubmit: (data: {
    recipient: string;
    assetId: string;
    startTime: Date;
    endTime: Date;
    totalAmount: string;
  }) => Promise<void>;
}

interface StreamFormData {
  recipient: string;
  rate: string;
  assetId: string;
  startTime: Date | null;
  endTime: Date | null;
}

interface TokenBalance {
  assetId: string;
  amount: string;
  symbol: string;
  decimals: number;
}

interface StreamDuration {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
}

export default function SendStream({ onSuccess, onSubmit }: SendStreamProps) {
  const { wallet } = useWallet();
  const [formData, setFormData] = useState<StreamFormData>({
    recipient: "",
    rate: "",
    assetId: "",
    startTime: new Date(),
    endTime: new Date(Date.now() + 5 * 60 * 1000),
  });
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([]);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [confirmData, setConfirmData] = useState<{
    totalAmount: string;
    duration: StreamDuration;
    selectedToken?: TokenBalance;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchBalances = async () => {
      if (!wallet?.provider || !wallet.address) return;

      try {
        const balances = (await wallet.provider.getBalances(wallet.address))
          .balances;
        const formattedBalances = balances.map((balance: CoinQuantity) => {
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

        setTokenBalances(formattedBalances);
      } catch (error) {
        console.error("Failed to fetch balances:", error);
      }
    };
    fetchBalances();
  }, [wallet]);

  // 计算时间间隔
  const calculateDuration = (
    start: Date | null,
    end: Date | null
  ): StreamDuration | null => {
    if (!start || !end) return null;

    const diffMs = end.getTime() - start.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);

    return {
      days: Math.floor(diffHours / 24),
      hours: diffHours % 24,
      minutes: diffMinutes % 60,
      seconds: diffSeconds % 60,
      totalSeconds: diffSeconds,
    };
  };

  // 计算总 Token 数量
  const calculateTotalAmount = (
    rate: string,
    duration: StreamDuration | null
  ): string => {
    if (!duration || !rate) return "0";
    const ratePerSecond = parseFloat(rate);
    return (ratePerSecond * duration.totalSeconds).toFixed(9);
  };

  // 当速率或时间改变时显示总量
  const renderStreamInfo = () => {
    const duration = calculateDuration(formData.startTime, formData.endTime);
    if (!duration || !formData.rate) return null;

    const selectedToken = tokenBalances.find(
      (t) => t.assetId === formData.assetId
    );

    const totalAmount = calculateTotalAmount(formData.rate, duration);
    const currentBalance = selectedToken?.amount || "0";

    // 检查余额是否足够
    const isInsufficientBalance =
      parseFloat(totalAmount) > parseFloat(currentBalance);

    return (
      <div className="text-sm text-gray-600 mt-2">
        <div>
          Duration: {duration.days} days, {duration.hours} hours,{" "}
          {duration.minutes} minutes, {duration.seconds} seconds
        </div>
        <div
          className={`text-lg font-bold mt-1 ${
            isInsufficientBalance ? "text-error" : ""
          }`}
        >
          Total Amount: {totalAmount} {selectedToken?.symbol}
        </div>
        {isInsufficientBalance && (
          <div className="text-error text-sm mt-1">
            Insufficient balance. You have {currentBalance}{" "}
            {selectedToken?.symbol}
          </div>
        )}
      </div>
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const duration = calculateDuration(formData.startTime, formData.endTime);
    if (!duration) {
      console.error("Invalid time range");
      return;
    }

    const totalAmount = calculateTotalAmount(formData.rate, duration);
    const selectedToken = tokenBalances.find(
      (t) => t.assetId === formData.assetId
    );

    // 设置确认数据并显示对话框
    setConfirmData({
      totalAmount,
      duration,
      selectedToken,
    });
    dialogRef.current?.showModal();
  };

  const handleConfirm = async () => {
    if (!confirmData || !formData.startTime || !formData.endTime) return;
    const selectedToken = tokenBalances.find(
      (t) => t.assetId === formData.assetId
    );

    try {
      setIsSubmitting(true);

      console.log(confirmData.totalAmount, typeof confirmData.totalAmount);
      // 将总量转换为考虑小数位数的大数
      const totalAmountWithDecimals = bn
        .parseUnits(confirmData.totalAmount, selectedToken?.decimals || 0)
        .toString();
      console.log(totalAmountWithDecimals);

      const params = {
        recipient: formData.recipient,
        assetId: formData.assetId,
        startTime: formData.startTime,
        endTime: formData.endTime,
        totalAmount: totalAmountWithDecimals, // 传递转换后的总量
      };

      console.log(params);

      await onSubmit(params);

      dialogRef.current?.close();
      onSuccess();
    } catch (error) {
      console.error("Transaction failed:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 添加验证函数
  const isValidDecimal = (value: string): boolean => {
    // 允许空字符串
    if (value === "") return true;
    // 验证是否为有效的小数格式
    return /^\d*\.?\d*$/.test(value) && !isNaN(parseFloat(value));
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 代币选择和余额显示 */}
        <div className="form-control">
          <label className="label">
            <span className="label-text">Asset</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={formData.assetId}
            onChange={(e) =>
              setFormData({ ...formData, assetId: e.target.value })
            }
          >
            <option value="" disabled>
              Select token
            </option>
            {tokenBalances.map((token) => (
              <option key={token.assetId} value={token.assetId}>
                {token.symbol}
              </option>
            ))}
          </select>
          {formData.assetId && (
            <div className="mt-2 text-sm text-gray-600 text-left">
              Balance:{" "}
              {
                tokenBalances.find((t) => t.assetId === formData.assetId)
                  ?.amount
              }{" "}
              {
                tokenBalances.find((t) => t.assetId === formData.assetId)
                  ?.symbol
              }
            </div>
          )}
        </div>

        {/* 接收地址 */}
        <div className="form-control">
          <label className="label">
            <span className="label-text">Recipient Address</span>
          </label>
          <input
            type="text"
            placeholder="Enter recipient address"
            className="input input-bordered w-full"
            value={formData.recipient}
            onChange={(e) =>
              setFormData({ ...formData, recipient: e.target.value })
            }
          />
        </div>

        {/* 速率输入 */}
        <div className="form-control">
          <label className="label">
            <span className="label-text">Rate (tokens per second)</span>
          </label>
          <input
            type="text"
            placeholder="Enter rate per second"
            className="input input-bordered w-full"
            value={formData.rate}
            onChange={(e) => {
              // 直接设置输入值，不做任何验证
              setFormData({ ...formData, rate: e.target.value });
            }}
          />
          {formData.rate &&
          formData.assetId &&
          isValidDecimal(formData.rate) &&
          parseFloat(formData.rate) > 0
            ? // 只在输入为有效数字时显示流信息
              renderStreamInfo()
            : formData.rate && (
                // 当有输入但不是有效数字时显示提示
                <div className="text-xs text-gray-500 mt-1">
                  * Please enter a valid positive number to see stream details
                </div>
              )}
        </div>

        {/* 开始时间 */}
        <div className="form-control">
          <label className="label">
            <span className="label-text">Start Time</span>
          </label>
          <DatePicker
            selected={formData.startTime}
            onChange={(date: Date | null) => {
              const newStartTime = date || new Date();
              setFormData({
                ...formData,
                startTime: newStartTime,
                endTime: new Date(newStartTime.getTime() + 5 * 60 * 1000),
              });
            }}
            showTimeSelect
            timeFormat="HH:mm"
            timeIntervals={15}
            timeCaption="time"
            dateFormat="MMMM d, yyyy h:mm aa"
            className="input input-bordered w-full"
            minDate={new Date()}
            placeholderText="Select start time"
          />
        </div>

        {/* 结束时间 */}
        <div className="form-control">
          <label className="label">
            <span className="label-text">End Time</span>
          </label>
          <DatePicker
            selected={formData.endTime}
            onChange={(date: Date | null) =>
              setFormData({
                ...formData,
                endTime: date || new Date(Date.now() + 5 * 60 * 1000),
              })
            }
            showTimeSelect
            timeFormat="HH:mm"
            timeIntervals={15}
            timeCaption="time"
            dateFormat="MMMM d, yyyy h:mm aa"
            className="input input-bordered w-full"
            minDate={
              new Date(formData.startTime?.getTime() || Date.now() + 60 * 1000)
            }
            placeholderText="Select end time"
          />
        </div>

        {/* 提交按钮 */}
        <div className="form-control mt-6">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={Boolean(
              !formData.rate ||
                !formData.recipient ||
                !formData.assetId ||
                !isValidDecimal(formData.rate) ||
                parseFloat(formData.rate) <= 0 ||
                (calculateDuration(formData.startTime, formData.endTime) &&
                  parseFloat(
                    calculateTotalAmount(
                      formData.rate,
                      calculateDuration(formData.startTime, formData.endTime)
                    )
                  ) >
                    parseFloat(
                      tokenBalances.find((t) => t.assetId === formData.assetId)
                        ?.amount || "0"
                    ))
            )}
          >
            Create Stream
          </button>
        </div>
      </form>

      {/* Confirmation Dialog */}
      <dialog ref={dialogRef} className="modal">
        <div className="modal-box">
          <h3 className="font-bold text-lg mb-4">Confirm Stream Creation</h3>
          {confirmData && (
            <div className="space-y-3">
              <div className="text-sm">
                <span className="font-semibold">Rate:</span> {formData.rate}{" "}
                {confirmData.selectedToken?.symbol} per second
              </div>
              <div className="text-sm">
                <span className="font-semibold">Duration:</span>{" "}
                {confirmData.duration.days} days, {confirmData.duration.hours}{" "}
                hours, {confirmData.duration.minutes} minutes,{" "}
                {confirmData.duration.seconds} seconds
              </div>
              <div className="text-lg font-bold">
                <span className="font-semibold">Total Amount:</span>{" "}
                {confirmData.totalAmount} {confirmData.selectedToken?.symbol}
              </div>
            </div>
          )}
          <div className="modal-action">
            <form method="dialog" className="flex gap-2">
              <button
                className="btn btn-ghost"
                onClick={() => dialogRef.current?.close()}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`btn btn-primary ${isSubmitting ? "loading" : ""}`}
                onClick={handleConfirm}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Creating..." : "Confirm"}
              </button>
            </form>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button disabled={isSubmitting}>close</button>
        </form>
      </dialog>
    </div>
  );
}
