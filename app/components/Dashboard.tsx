"use client";

import { useEffect, useState } from "react";
import {
    SubscriptionClient,
    InfoClient,
    WebSocketTransport,
    TradesWsEvent,
    L2BookWsEvent,
} from "@nktkas/hyperliquid";
import TradingViewChart from "./TradingViewChart";
import OrderPanel from "./OrderPanel";

// Define Trade interface locally
type TradeData = TradesWsEvent[0];

interface ISubscription {
    unsubscribe(): Promise<void>;
}

export default function Dashboard() {
    const [coins, setCoins] = useState<string[]>([]);
    const [selectedCoin, setSelectedCoin] = useState("BTC");
    const [trades, setTrades] = useState<TradeData[]>([]);
    const [l2Book, setL2Book] = useState<L2BookWsEvent | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [client, setClient] = useState<SubscriptionClient | null>(null);
    const [error, setError] = useState<string | null>(null);

    // 1. Initialize Connection and Fetch Metadata
    useEffect(() => {
        const transport = new WebSocketTransport({ isTestnet: true });
        const infoClient = new InfoClient({ transport });

        const subClient = new SubscriptionClient({ transport });

        const init = async () => {
            try {
                await transport.ready();
                setIsConnected(true);
                setClient(subClient);

                const meta = await infoClient.meta();
                const universe = meta.universe.map((u) => u.name);
                setCoins(universe);

                if (universe.length > 0 && !universe.includes("BTC")) {
                    setSelectedCoin(universe[0]);
                }
            } catch (err: unknown) {
                console.error("Initialization error:", err);
                const errorMessage = err instanceof Error ? err.message : "Failed to connect";
                setError(errorMessage);
            }
        };

        init();

        return () => {
            transport.close();
        };
    }, []);

    // 2. Manage Subscriptions when selectedCoin or client changes
    useEffect(() => {
        if (!client || !isConnected) return;

        let tradesSub: ISubscription | undefined;
        let l2BookSub: ISubscription | undefined;

        const subscribe = async () => {
            try {
                tradesSub = await client.trades(
                    { coin: selectedCoin },
                    (data) => {
                        setTrades((prev) => {
                            const newTrades = [...data, ...prev];
                            return newTrades.slice(0, 50);
                        });
                    }
                );

                l2BookSub = await client.l2Book(
                    { coin: selectedCoin },
                    (data) => {
                        setL2Book(data);
                    }
                );
            } catch (e) {
                console.error("Subscription error", e);
            }
        };

        subscribe();

        return () => {
            if (tradesSub) tradesSub.unsubscribe();
            if (l2BookSub) l2BookSub.unsubscribe();
        };
    }, [client, isConnected, selectedCoin]);

    const formatPrice = (price: string) => {
        const p = parseFloat(price);
        return isNaN(p) ? price : p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 5 });
    };

    const formatSize = (size: string) => {
        const s = parseFloat(size);
        return isNaN(s) ? size : s.toFixed(4);
    };

    const formatTime = (ts: number) => {
        return new Date(ts).toLocaleTimeString();
    };

    if (error) {
        return <div className="p-4 text-red-500">Error: {error}</div>;
    }

    if (!isConnected) {
        return <div className="p-4 text-gray-400">Connecting to Hyperliquid...</div>;
    }

    const currentPrice = l2Book?.levels[0][0]?.px || l2Book?.levels[1][0]?.px || "-";

    return (
        <div className="min-h-screen bg-neutral-900 text-gray-200 p-6 font-sans">
            <header className="mb-6 flex items-center justify-between border-b border-gray-700 pb-4">
                <div className="flex items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                            <select
                                value={selectedCoin}
                                onChange={(e) => {
                                    setTrades([]);
                                    setL2Book(null);
                                    setSelectedCoin(e.target.value);
                                }}
                                className="bg-neutral-800 border border-gray-600 rounded px-2 py-1 text-white focus:outline-none focus:border-blue-500 cursor-pointer hover:bg-neutral-700 transition"
                            >
                                {coins.length > 0 ? (
                                    coins.map(c => <option key={c} value={c}>{c}</option>)
                                ) : (
                                    <option value={selectedCoin}>{selectedCoin}</option>
                                )}
                            </select>
                            <span>/ USD</span>
                        </h1>
                        <p className="text-sm text-gray-400 mt-1">Hyperliquid Perps</p>
                    </div>
                </div>
                <div className="text-3xl font-bold text-white">
                    ${formatPrice(currentPrice)}
                </div>
            </header>

            {/* TradingView Chart and Order Panel */}
            <div className="mb-6 flex flex-col xl:flex-row gap-6">
                <div className="flex-1 h-[600px] bg-neutral-800 rounded-lg shadow-lg border border-gray-700 overflow-hidden">
                    <TradingViewChart symbol={selectedCoin} />
                </div>
                <div className="w-full xl:w-[380px] shrink-0">
                    <OrderPanel
                        symbol={selectedCoin}
                        currentPrice={currentPrice === "-" ? "0" : currentPrice}
                        assetIndex={coins.indexOf(selectedCoin)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Order Book Panel */}
                <div className="bg-neutral-800 rounded-lg p-4 shadow-lg border border-gray-700">
                    <h2 className="text-lg font-semibold mb-4 text-white border-b border-gray-700 pb-2">Order Book ({selectedCoin})</h2>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        {/* Asks (Sells) - Red */}
                        <div>
                            <div className="grid grid-cols-2 text-xs text-gray-500 mb-2">
                                <span>Price</span>
                                <span className="text-right">Size</span>
                            </div>
                            <div className="space-y-1">
                                {l2Book?.levels[1].slice(0, 15).reverse().map((ask, i) => (
                                    <div key={i} className="grid grid-cols-2 text-red-400">
                                        <span>{formatPrice(ask.px)}</span>
                                        <span className="text-right">{formatSize(ask.sz)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Bids (Buys) - Green */}
                        <div>
                            <div className="grid grid-cols-2 text-xs text-gray-500 mb-2">
                                <span>Price</span>
                                <span className="text-right">Size</span>
                            </div>
                            <div className="space-y-1">
                                {l2Book?.levels[0].slice(0, 15).map((bid, i) => (
                                    <div key={i} className="grid grid-cols-2 text-green-400">
                                        <span>{formatPrice(bid.px)}</span>
                                        <span className="text-right">{formatSize(bid.sz)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Recent Trades Panel */}
                <div className="bg-neutral-800 rounded-lg p-4 shadow-lg border border-gray-700">
                    <h2 className="text-lg font-semibold mb-4 text-white border-b border-gray-700 pb-2">Recent Trades ({selectedCoin})</h2>
                    <div className="overflow-auto max-h-[600px]">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-500 uppercase sticky top-0 bg-neutral-800">
                                <tr>
                                    <th className="pb-2">Price</th>
                                    <th className="pb-2 text-right">Size</th>
                                    <th className="pb-2 text-right">Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                {trades.map((trade, i) => (
                                    <tr key={trade.hash + i} className="border-b border-gray-700/50 hover:bg-white/5">
                                        <td className={`py-1 ${trade.side === 'B' ? 'text-green-400' : 'text-red-400'}`}>
                                            {formatPrice(trade.px)}
                                        </td>
                                        <td className="py-1 text-right text-gray-300">{formatSize(trade.sz)}</td>
                                        <td className="py-1 text-right text-gray-500 text-xs">{formatTime(trade.time)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
