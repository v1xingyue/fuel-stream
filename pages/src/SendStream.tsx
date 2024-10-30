import { useState, useEffect } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { FuelStream } from "./contract-types";
import { bn, Address, CoinQuantity } from "fuels";
import { useWallet } from "@fuels/react";

interface SendStreamProps {
  contract: FuelStream | undefined;
  onSuccess: () => void;
}

interface StreamFormData {
  recipient: string;
  amount: string;
  assetId: string;
  startTime: Date | null;
  endTime: Date | null;
}

interface TokenInfo {
  id: string;
  symbol: string;
  decimals: number;
}

interface TokenBalance {
  assetId: string;
  amount: string;
  symbol: string;
  decimals: number;
}

const TOKENS: TokenInfo[] = [
  {
    id: "0x0000000000000000000000000000000000000000000000000000000000000000",
    symbol: "ETH",
    decimals: 18,
  },
  {
    id: "0x1111111111111111111111111111111111111111111111111111111111111111",
    symbol: "USDC",
    decimals: 6,
  },
];

export default function SendStream({ contract, onSuccess }: SendStreamProps) {
  const { wallet } = useWallet();
  const [formData, setFormData] = useState<StreamFormData>({
    recipient: "",
    amount: "",
    assetId: "",
    startTime: new Date(),
    endTime: new Date(Date.now() + 3600000),
  });
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Form submitted:", formData);
    try {
      onSuccess();
    } catch (error) {
      console.error("Transaction failed:", error);
    }
  };

  const selectedToken = TOKENS.find((token) => token.id === formData.assetId);

  return (
    <div className="w-full max-w-3xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 代币选择和余额列表 */}
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

          {/* 显示所有代币余额 */}
          <div className="mt-4 space-y-2">
            <div className="text-sm font-semibold text-left">
              Available Tokens:
            </div>
            {tokenBalances.map((token) => (
              <div
                key={token.assetId}
                className="text-sm text-gray-600 text-left flex justify-between items-center p-2 bg-base-200 rounded-lg"
              >
                <span>{token.symbol}</span>
                <span>{token.amount}</span>
              </div>
            ))}
          </div>
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

        {/* 金额 */}
        <div className="form-control">
          <label className="label">
            <span className="label-text">Amount</span>
          </label>
          <input
            type="text"
            pattern="[0-9]*"
            inputMode="numeric"
            placeholder="Enter amount"
            className="input input-bordered w-full"
            value={formData.amount}
            onChange={(e) => {
              const value = e.target.value.replace(/[^0-9]/g, "");
              setFormData({ ...formData, amount: value });
            }}
            style={{ appearance: "textfield" }}
          />
        </div>

        {/* 开始时间 - 使用 react-datepicker */}
        <div className="form-control">
          <label className="label">
            <span className="label-text">Start Time</span>
          </label>
          <DatePicker
            selected={formData.startTime}
            onChange={(date: Date | null) =>
              setFormData({ ...formData, startTime: date || new Date() })
            }
            showTimeSelect
            timeFormat="HH:mm"
            timeIntervals={15}
            timeCaption="time"
            dateFormat="MMMM d, yyyy h:mm aa"
            className="input input-bordered w-full"
            minDate={new Date()} // 不允许选择过去的时间
            placeholderText="Select start time"
          />
        </div>

        {/* 结束时间选择 */}
        <div className="form-control">
          <label className="label">
            <span className="label-text">End Time</span>
          </label>
          <DatePicker
            selected={formData.endTime}
            onChange={(date: Date | null) =>
              setFormData({ ...formData, endTime: date || new Date() })
            }
            showTimeSelect
            timeFormat="HH:mm"
            timeIntervals={15}
            timeCaption="time"
            dateFormat="MMMM d, yyyy h:mm aa"
            className="input input-bordered w-full"
            minDate={formData.startTime || new Date()} // 确保结束时间不早于开始时间
            placeholderText="Select end time"
          />
        </div>

        {/* 提交按钮 */}
        <div className="form-control mt-6">
          <button type="submit" className="btn btn-primary">
            Create Stream
          </button>
        </div>
      </form>
    </div>
  );
}
