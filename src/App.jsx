import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import "./App.css";

const COINS_PER_PAGE = 20;

function App() {
  const [coins, setCoins] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedCoin, setSelectedCoin] = useState("bitcoin");

  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Load Top 100 cryptocurrencies
  const loadCoins = async () => {
    try {
      setError("");

      const response = await fetch(
        "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h"
      );

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();

      console.log("Top 100 Crypto Data:", data);

      if (!Array.isArray(data) || data.length === 0) {
        throw new Error("No cryptocurrency data received");
      }

      setCoins(data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Crypto API Error:", error);

      setError(
        "Unable to load cryptocurrency data. Please try again."
      );
    }
  };

  // Initial load + automatic refresh
  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      await loadCoins();
      setLoading(false);
    };

    loadInitialData();

    const interval = setInterval(() => {
      loadCoins();
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // Manual refresh
  const refreshPrices = async () => {
    setRefreshing(true);
    await loadCoins();
    setRefreshing(false);
  };

  // Load 7-day historical data
  useEffect(() => {
    if (!selectedCoin) return;

    const loadHistory = async () => {
      try {
        setChartLoading(true);

        const response = await fetch(
          `https://api.coingecko.com/api/v3/coins/${selectedCoin}/market_chart?vs_currency=usd&days=7`
        );

        if (!response.ok) {
          throw new Error(
            `History API Error: ${response.status}`
          );
        }

        const data = await response.json();

        console.log("Historical API Data:", data);

        if (!data.prices || data.prices.length === 0) {
          throw new Error("No historical data available");
        }

        const chartData = data.prices.map((item) => ({
          timestamp: item[0],
          time: new Date(item[0]).toLocaleDateString([], {
            month: "short",
            day: "numeric",
          }),
          price: item[1],
        }));

        setHistory(chartData);
      } catch (error) {
        console.error("History API Error:", error);
        setHistory([]);
      } finally {
        setChartLoading(false);
      }
    };

    loadHistory();
  }, [selectedCoin]);

  // Search
  const filteredCoins = coins.filter((coin) => {
    const searchText = search.toLowerCase();

    return (
      coin.name.toLowerCase().includes(searchText) ||
      coin.symbol.toLowerCase().includes(searchText)
    );
  });

  // Pagination
  const totalPages = Math.ceil(
    filteredCoins.length / COINS_PER_PAGE
  );

  const startIndex =
    (currentPage - 1) * COINS_PER_PAGE;

  const displayedCoins = filteredCoins.slice(
    startIndex,
    startIndex + COINS_PER_PAGE
  );

  const handleSearch = (value) => {
    setSearch(value);
    setCurrentPage(1);
  };

  // Selected coin
  const selectedCoinData = coins.find(
    (coin) => coin.id === selectedCoin
  );

  return (
    <div className="dashboard">

      {/* ================= HEADER ================= */}

      <div className="dashboard-header">

        <div>
          <h1>₿ Cryptocurrency Dashboard</h1>

          <p className="subtitle">
            Top 100 Cryptocurrencies & Market History
          </p>

          {lastUpdated && (
            <p className="last-updated">
              Last updated:{" "}
              {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>

        <div className="header-right">

          <div className="developer-name">
            <span>Developed by</span>
            <strong>Omkar Deokar</strong>
          </div>

          <button
            className="refresh-button"
            onClick={refreshPrices}
            disabled={refreshing}
          >
            {refreshing
              ? "Refreshing..."
              : "🔄 Refresh Prices"}
          </button>

        </div>

      </div>

      {/* ================= ERROR ================= */}

      {error && (
        <p className="error-message">
          {error}
        </p>
      )}

      {/* ================= TOP 100 ================= */}

      <div className="market-container">

        <div className="market-header">

          <div>
            <h2>Top 100 Cryptocurrencies</h2>

            <p>
              Ranked by market capitalization
            </p>
          </div>

          <input
            type="text"
            placeholder="🔎 Search cryptocurrency..."
            value={search}
            onChange={(e) =>
              handleSearch(e.target.value)
            }
            className="search-input"
          />

        </div>

        {/* Loading */}

        {loading ? (

          <div className="loading-container">

            <div className="loading-spinner"></div>

            <p>
              Loading top cryptocurrencies...
            </p>

          </div>

        ) : displayedCoins.length > 0 ? (

          /* Crypto Cards */

          <div className="crypto-grid">

            {displayedCoins.map((coin) => (

              <div
                className={`crypto-card ${
                  selectedCoin === coin.id
                    ? "selected-card"
                    : ""
                }`}
                key={coin.id}
                onClick={() =>
                  setSelectedCoin(coin.id)
                }
              >

                <div className="coin-top">

                  <span className="coin-rank">
                    #{coin.market_cap_rank}
                  </span>

                  <img
                    src={coin.image}
                    alt={coin.name}
                    className="coin-image"
                  />

                  <div className="coin-title">

                    <h2>
                      {coin.name}
                    </h2>

                    <p className="coin-name">
                      {coin.symbol.toUpperCase()} / USD
                    </p>

                  </div>

                </div>

                <p className="price">
                  $
                  {Number(
                    coin.current_price
                  ).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 6,
                  })}
                </p>

                <p
                  className={
                    coin.price_change_percentage_24h >= 0
                      ? "positive"
                      : "negative"
                  }
                >
                  {coin.price_change_percentage_24h >= 0
                    ? "▲"
                    : "▼"}{" "}
                  {Math.abs(
                    coin.price_change_percentage_24h || 0
                  ).toFixed(2)}
                  %
                </p>

                <div className="market-info">

                  <div>

                    <span>
                      Market Cap
                    </span>

                    <strong>
                      $
                      {Number(
                        coin.market_cap
                      ).toLocaleString()}
                    </strong>

                  </div>

                  <div>

                    <span>
                      24h Volume
                    </span>

                    <strong>
                      $
                      {Number(
                        coin.total_volume
                      ).toLocaleString()}
                    </strong>

                  </div>

                </div>

                <p className="live-badge">
                  ● Live Market
                </p>

              </div>

            ))}

          </div>

        ) : (

          <div className="no-results">

            <h3>
              No cryptocurrency found
            </h3>

            <p>
              Try searching with another name or symbol.
            </p>

          </div>

        )}

        {/* Pagination */}

        {totalPages > 1 && (

          <div className="pagination">

            <button
              onClick={() =>
                setCurrentPage((page) =>
                  Math.max(page - 1, 1)
                )
              }
              disabled={currentPage === 1}
            >
              ← Previous
            </button>

            <span>
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={() =>
                setCurrentPage((page) =>
                  Math.min(
                    page + 1,
                    totalPages
                  )
                )
              }
              disabled={
                currentPage === totalPages
              }
            >
              Next →
            </button>

          </div>

        )}

      </div>

      {/* ================= CHART ================= */}

      <div className="chart-container">

        <div className="chart-header">

          <div>

            <h2>
              7 Day Price History
            </h2>

            <p>
              Historical price movement of the selected cryptocurrency
            </p>

          </div>

          <select
            value={selectedCoin}
            onChange={(e) =>
              setSelectedCoin(e.target.value)
            }
          >

            {coins.map((coin) => (

              <option
                key={coin.id}
                value={coin.id}
              >
                {coin.name}
              </option>

            ))}

          </select>

        </div>

        {/* Selected Coin */}

        {selectedCoinData && (

          <div className="selected-coin-info">

            <img
              src={selectedCoinData.image}
              alt={selectedCoinData.name}
            />

            <div>

              <strong>
                {selectedCoinData.name}
              </strong>

              <span>
                {selectedCoinData.symbol.toUpperCase()}
              </span>

            </div>

            <strong>

              $
              {Number(
                selectedCoinData.current_price
              ).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 6,
              })}

            </strong>

          </div>

        )}

        {/* Chart */}

        {chartLoading ? (

          <div className="loading-container">

            <div className="loading-spinner"></div>

            <p>
              Loading chart...
            </p>

          </div>

        ) : history.length > 0 ? (

          <div className="chart-wrapper">

            <ResponsiveContainer
              width="100%"
              height="100%"
            >

              <LineChart
                data={history}
                margin={{
                  top: 10,
                  right: 30,
                  left: 20,
                  bottom: 30,
                }}
              >

                <CartesianGrid
                  strokeDasharray="3 3"
                />

                <XAxis
                  dataKey="time"
                  interval={Math.max(
                    Math.floor(
                      history.length / 7
                    ),
                    1
                  )}
                  tick={{
                    fontSize: 12,
                  }}
                  angle={-25}
                  textAnchor="end"
                />

                <YAxis
                  tickFormatter={(value) =>
                    `$${Number(
                      value
                    ).toLocaleString()}`
                  }
                  tick={{
                    fontSize: 12,
                  }}
                />

                <Tooltip
                  formatter={(value) => [
                    `$${Number(
                      value
                    ).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`,
                    "Price",
                  ]}
                />

                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="#2563eb"
                  strokeWidth={3}
                  dot={false}
                />

              </LineChart>

            </ResponsiveContainer>

          </div>

        ) : (

          <p>
            No historical data available.
          </p>

        )}

      </div>

    </div>
  );
}

export default App;