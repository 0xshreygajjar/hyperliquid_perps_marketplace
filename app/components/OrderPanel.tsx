"use client";

import React, { useState } from 'react';
import { ExchangeClient, WebSocketTransport } from '@nktkas/hyperliquid';
import { PrivateKeySigner } from '@nktkas/hyperliquid/signing';

interface Props {
    symbol: string;
    currentPrice: string;
    assetIndex: number;
}

export default function OrderPanel({ symbol, currentPrice, assetIndex }: Props) {
    const [side, setSide] = useState<'buy' | 'sell'>('buy');
    const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
    const [size, setSize] = useState('');
    const [limitPrice, setLimitPrice] = useState(currentPrice);
    const [privateKey, setPrivateKey] = useState('');
    const [showKey, setShowKey] = useState(false);
    const [status, setStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error', message: string }>({ type: 'idle', message: '' });

    // Update limit price when current price changes and user is in market mode or hasn't touched it
    React.useEffect(() => {
        if (orderType === 'market') {
            setLimitPrice(currentPrice);
        }
    }, [currentPrice, orderType]);

    const handlePlaceOrder = async () => {
        if (!privateKey) {
            setStatus({ type: 'error', message: 'Private key is required' });
            return;
        }
        if (!size || parseFloat(size) <= 0) {
            setStatus({ type: 'error', message: 'Invalid size' });
            return;
        }
        if (assetIndex === -1) {
            setStatus({ type: 'error', message: 'Unknown asset index' });
            return;
        }

        setStatus({ type: 'loading', message: 'Placing order...' });

        try {
            // Initialize signer and exchange client
            const signer = new PrivateKeySigner(privateKey);
            const transport = new WebSocketTransport({ isTestnet: true });
            const exchangeClient = new ExchangeClient({ transport, wallet: signer });

            const isBuy = side === 'buy';
            const price = orderType === 'market' ? parseFloat(currentPrice) : parseFloat(limitPrice);

            // For market orders, use a safe limit price (slippage)
            // BUY: Market price + 1%, SELL: Market price - 1%
            const slippage = 0.01;
            const executionPrice = orderType === 'market'
                ? (isBuy ? price * (1 + slippage) : price * (1 - slippage))
                : price;

            // Hyperliquid expects price and size as strings with specific decimals
            // Using toFixed(6) as a general safe bet for perps
            const pStr = executionPrice.toFixed(6);
            const sStr = parseFloat(size).toFixed(6);

            const response = await exchangeClient.order({
                orders: [{
                    a: assetIndex,
                    b: isBuy,
                    p: pStr,
                    s: sStr,
                    r: false,
                    t: { limit: { tif: 'Gtc' } }
                }],
                grouping: 'na'
            });

            if (response.status === 'ok') {
                const orderStatus = response.response.data.statuses[0];
                if (orderStatus && typeof orderStatus === 'object') {
                    const s = orderStatus as any;
                    if (s.resting) {
                        setStatus({ type: 'success', message: `Order placed! OID: ${s.resting.oid}` });
                    } else if (s.filled) {
                        setStatus({ type: 'success', message: `Order filled! OID: ${s.filled.oid}. Avg Px: ${s.filled.avgPx}` });
                    } else if (s.error) {
                        setStatus({ type: 'error', message: `Exchange Error: ${s.error}` });
                    }
                } else if (typeof orderStatus === 'string') {
                    setStatus({ type: 'success', message: `Order status: ${orderStatus}` });
                }
            } else {


                setStatus({ type: 'error', message: `Failed: ${JSON.stringify(response)}` });
            }
        } catch (err: unknown) {
            console.error(err);
            const message = err instanceof Error ? err.message : 'Failed to place order';
            setStatus({ type: 'error', message });
        }

    };

    return (
        <div className="bg-neutral-800 rounded-lg p-5 shadow-lg border border-gray-700 h-full flex flex-col font-sans">
            <h2 className="text-xl font-bold text-white mb-4 border-b border-gray-700 pb-2 flex justify-between items-center">
                <span>Place Order</span>
                <span className="text-xs font-normal text-gray-500">Asset ID: {assetIndex}</span>
            </h2>

            {/* Side Selector */}
            <div className="flex mb-4 bg-neutral-900 rounded p-1">
                <button
                    onClick={() => setSide('buy')}
                    className={`flex-1 py-2 rounded transition font-bold ${side === 'buy' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                    BUY
                </button>
                <button
                    onClick={() => setSide('sell')}
                    className={`flex-1 py-2 rounded transition font-bold ${side === 'sell' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                    SELL
                </button>
            </div>

            {/* Order Type Selector */}
            <div className="flex mb-4 border-b border-gray-700">
                <button
                    onClick={() => setOrderType('market')}
                    className={`pb-2 px-4 transition border-b-2 text-sm ${orderType === 'market' ? 'border-blue-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                >
                    Market
                </button>
                <button
                    onClick={() => setOrderType('limit')}
                    className={`pb-2 px-4 transition border-b-2 text-sm ${orderType === 'limit' ? 'border-blue-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                >
                    Limit
                </button>
            </div>

            {/* Inputs */}
            <div className="space-y-4 mb-6">
                <div>
                    <label className="block text-xs text-gray-500 mb-1">Price (USD)</label>
                    <input
                        type="number"
                        value={limitPrice}
                        disabled={orderType === 'market'}
                        onChange={(e) => setLimitPrice(e.target.value)}
                        className={`w-full bg-neutral-900 border border-gray-700 rounded p-2 text-white focus:outline-none focus:border-blue-500 ${orderType === 'market' ? 'opacity-50 cursor-not-allowed' : ''}`}
                        placeholder="0.00"
                    />
                    {orderType === 'market' && <p className="text-[10px] text-gray-500 mt-1">Slippage protection: 1%</p>}
                </div>

                <div>
                    <label className="block text-xs text-gray-500 mb-1">Size ({symbol})</label>
                    <input
                        type="number"
                        value={size}
                        onChange={(e) => setSize(e.target.value)}
                        className="w-full bg-neutral-900 border border-gray-700 rounded p-2 text-white focus:outline-none focus:border-blue-500"
                        placeholder="0.00"
                    />
                </div>

                <div>
                    <label className="block text-xs text-gray-500 mb-1">Private Key</label>
                    <div className="relative">
                        <input
                            type={showKey ? "text" : "password"}
                            value={privateKey}
                            onChange={(e) => setPrivateKey(e.target.value)}
                            className="w-full bg-neutral-900 border border-gray-700 rounded p-2 text-white focus:outline-none focus:border-blue-500 pr-10"
                            placeholder="0x..."
                        />
                        <button
                            type="button"
                            onClick={() => setShowKey(!showKey)}
                            className="absolute right-2 top-2 text-gray-500 hover:text-gray-300"
                        >
                            {showKey ? "🙈" : "👁️"}
                        </button>
                    </div>
                    <p className="text-[10px] text-amber-500 mt-1 italic">Connected to Mainnet. Use with caution.</p>
                </div>
            </div>

            {/* Action Button */}
            <button
                onClick={handlePlaceOrder}
                disabled={status.type === 'loading'}
                className={`w-full py-4 rounded font-bold transition mb-3 shadow-lg ${status.type === 'loading' ? 'bg-gray-600 cursor-not-allowed' :
                    side === 'buy' ? 'bg-green-600 hover:bg-green-500 shadow-green-900/20' : 'bg-red-600 hover:bg-red-500 shadow-red-900/20'
                    } text-white`}
            >
                {status.type === 'loading' ? (
                    <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        Processing...
                    </span>
                ) : `${side.toUpperCase()} ${symbol}`}
            </button>

            {/* Status Message */}
            {status.message && (
                <div className={`p-3 rounded text-xs break-all ${status.type === 'success' ? 'bg-green-900/30 text-green-400 border border-green-800' :
                    status.type === 'error' ? 'bg-red-900/30 text-red-400 border border-red-800' :
                        'bg-blue-900/30 text-blue-400 border border-blue-800'
                    }`}>
                    {status.message}
                </div>
            )}

            <div className="mt-auto pt-4 border-t border-gray-700">
                <div className="flex justify-between text-xs text-gray-500">
                    <span>Est. Value:</span>
                    <span className="text-white">${(parseFloat(size || '0') * parseFloat(limitPrice || '0')).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
            </div>
        </div>
    );
}
