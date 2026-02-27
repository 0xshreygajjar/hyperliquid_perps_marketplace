"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { InfoClient, WebSocketTransport } from '@nktkas/hyperliquid';

interface Props {
    address: string;
}

export default function AccountDetails({ address }: Props) {
    const [activeTab, setActiveTab] = useState<'positions' | 'orders' | 'history'>('positions');
    const [positions, setPositions] = useState<any[]>([]);
    const [openOrders, setOpenOrders] = useState<any[]>([]);
    const [fills, setFills] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const infoClient = useMemo(() => {
        const transport = new WebSocketTransport({ isTestnet: true });
        return new InfoClient({ transport });
    }, []);

    const fetchData = useCallback(async () => {
        if (!address || !address.startsWith('0x')) return;
        setLoading(true);
        setError(null);
        try {
            // Fetch everything in parallel
            const [state, orders, userFills] = await Promise.all([
                infoClient.clearinghouseState({ user: address }),
                infoClient.openOrders({ user: address }),
                infoClient.userFills({ user: address })
            ]);

            setPositions(state.assetPositions.map((ap: any) => ap.position));
            setOpenOrders(orders);
            setFills(userFills as any[]);
        } catch (err) {
            console.error("Error fetching account data:", err);
            setError("Failed to load account data");
        } finally {
            setLoading(false);
        }
    }, [address, infoClient]);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000); // Refresh every 10s
        return () => clearInterval(interval);
    }, [fetchData]);

    const formatPrice = (price: string) => parseFloat(price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formatSize = (size: string) => parseFloat(size).toFixed(4);

    return (
        <div className="bg-neutral-800 rounded-lg shadow-lg border border-gray-700 overflow-hidden flex flex-col h-full font-sans">
            <div className="flex border-b border-gray-700 bg-neutral-900/50">
                {(['positions', 'orders', 'history'] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-6 py-3 text-sm font-medium transition-colors relative ${activeTab === tab ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'
                            }`}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        {activeTab === tab && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
                        )}
                        {tab === 'orders' && openOrders.length > 0 && (
                            <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-blue-500/20 text-blue-400 rounded-full">
                                {openOrders.length}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-auto bg-neutral-800 p-4">
                {loading && !positions.length && !openOrders.length && !fills.length ? (
                    <div className="flex items-center justify-center h-40">
                        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : error ? (
                    <div className="p-4 text-red-400 text-center">{error}</div>
                ) : !address ? (
                    <div className="p-10 text-center text-gray-500">
                        Enter a wallet address to see your data
                    </div>
                ) : (
                    <>
                        {activeTab === 'positions' && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-gray-500 uppercase border-b border-gray-700">
                                        <tr>
                                            <th className="pb-3 px-2">Asset</th>
                                            <th className="pb-3 px-2">Size</th>
                                            <th className="pb-3 px-2">Entry Price</th>
                                            <th className="pb-3 px-2">Mark Price</th>
                                            <th className="pb-3 px-2 text-right">PnL</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700/50">
                                        {positions.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="py-8 text-center text-gray-500">No active positions</td>
                                            </tr>
                                        ) : (
                                            positions.map((pos: any, i: number) => {
                                                const pnl = parseFloat(pos.unrealizedPnl);
                                                return (
                                                    <tr key={i} className="hover:bg-white/5 transition-colors">
                                                        <td className="py-3 px-2 font-medium text-white">{pos.coin}</td>
                                                        <td className={`py-3 px-2 ${parseFloat(pos.szi) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                            {formatSize(pos.szi)}
                                                        </td>
                                                        <td className="py-3 px-2 text-gray-300">${formatPrice(pos.entryPx)}</td>
                                                        <td className="py-3 px-2 text-gray-300">--</td>
                                                        <td className={`py-3 px-2 text-right ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                            {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)} USD
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {activeTab === 'orders' && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-gray-500 uppercase border-b border-gray-700">
                                        <tr>
                                            <th className="pb-3 px-2">Asset</th>
                                            <th className="pb-3 px-2">Side</th>
                                            <th className="pb-3 px-2">Size</th>
                                            <th className="pb-3 px-2">Limit Price</th>
                                            <th className="pb-3 px-2 text-right">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700/50">
                                        {openOrders.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="py-8 text-center text-gray-500">No open orders</td>
                                            </tr>
                                        ) : (
                                            openOrders.map((order: any, i: number) => (
                                                <tr key={i} className="hover:bg-white/5 transition-colors">
                                                    <td className="py-3 px-2 font-medium text-white">{order.coin}</td>
                                                    <td className={`py-3 px-2 ${order.side === 'B' ? 'text-green-400' : 'text-red-400'}`}>
                                                        {order.side === 'B' ? 'BUY' : 'SELL'}
                                                    </td>
                                                    <td className="py-3 px-2 text-gray-300">{formatSize(order.sz)}</td>
                                                    <td className="py-3 px-2 text-gray-300">${formatPrice(order.limitPx)}</td>
                                                    <td className="py-3 px-2 text-right">
                                                        <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] border border-blue-500/20">
                                                            Open
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {activeTab === 'history' && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-gray-500 uppercase border-b border-gray-700">
                                        <tr>
                                            <th className="pb-3 px-2">Asset</th>
                                            <th className="pb-3 px-2">Side</th>
                                            <th className="pb-3 px-2">Price</th>
                                            <th className="pb-3 px-2 text-right">Size</th>
                                            <th className="pb-3 px-2 text-right">Time</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700/50">
                                        {fills.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="py-8 text-center text-gray-500">No trade history</td>
                                            </tr>
                                        ) : (
                                            fills.slice(0, 50).map((fill: any, i: number) => (
                                                <tr key={i} className="hover:bg-white/5 transition-colors">
                                                    <td className="py-3 px-2 font-medium text-white">{fill.coin}</td>
                                                    <td className={`py-3 px-2 ${fill.side === 'B' ? 'text-green-400' : 'text-red-400'}`}>
                                                        {fill.side === 'B' ? 'BUY' : 'SELL'}
                                                    </td>
                                                    <td className="py-3 px-2 text-gray-300">${formatPrice(fill.px)}</td>
                                                    <td className="py-3 px-2 text-right text-gray-300">{formatSize(fill.sz)}</td>
                                                    <td className="py-3 px-2 text-right text-gray-500 text-xs">
                                                        {new Date(fill.time).toLocaleTimeString()}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
