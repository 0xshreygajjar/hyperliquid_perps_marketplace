"use client";

import React, { useEffect, useRef, memo } from 'react';

interface Props {
    symbol: string;
}

function TradingViewWidget({ symbol }: Props) {
    const container = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (typeof window === "undefined" || !container.current) return;

        // Clear previous widget
        container.current.innerHTML = "";

        // Map Hyperliquid symbols to TradingView symbols if needed
        // Most HL perps can be mapped to Binance for charting if HL isn't directly available
        const tvSymbol = symbol === "PURR" ? "MEXC:PURR" : `BINANCE:${symbol}USDT`;

        const script = document.createElement("script");
        script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
        script.type = "text/javascript";
        script.async = true;
        script.innerHTML = JSON.stringify({
        "allow_symbol_change": false,
        "calendar": false,
        "details": false,
        "hide_side_toolbar": true,
        "hide_top_toolbar": false,
        "hide_legend": false,
        "hide_volume": false,
        "hotlist": false,
        "interval": "5",
        "locale": "en",
        "save_image": true,
        "style": "1",
            "symbol": tvSymbol,
        "theme": "dark",
        "timezone": "Etc/UTC",
        "backgroundColor": "#171717",
        "gridColor": "rgba(242, 242, 242, 0.06)",
        "watchlist": [],
        "withdateranges": false,
        "compareSymbols": [],
        "studies": [],
        "autosize": true
        });
        container.current.appendChild(script);
    }, [symbol]);

    return (
        <div className="tradingview-widget-container" ref={container} style={{ height: "100%", width: "100%" }}>
            <div className="tradingview-widget-container__widget" style={{ height: "calc(100% - 32px)", width: "100%" }}></div>
            <div className="tradingview-widget-copyright">
                <a href={`https://www.tradingview.com/symbols/${symbol}USDT/`} rel="noopener nofollow" target="_blank">
                    <span className="blue-text">{symbol} price</span>
                </a>
                <span className="trademark"> by TradingView</span>
            </div>
        </div>
    );
}

export default memo(TradingViewWidget);
