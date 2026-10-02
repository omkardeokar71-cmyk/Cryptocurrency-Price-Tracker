import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./App.css";

const API_URL = "https://api.coingecko.com/api/v3/coins/markets";
const CHART_API = "https://api.coingecko.com/api/v3/coins";

const API_PER_PAGE = 50;
const INITIAL_BALANCE = 10000;

const ACCOUNT_KEY = "bitpulse_demo_account";

function formatCurrency(value) {
  const number = Number(value) || 0;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(number);
}

function formatCompactNumber(value) {
  const number = Number(value) || 0;

  if (number >= 1e12) {
    return "$" + (number / 1e12).toFixed(2) + "T";
  }

  if (number >= 1e9) {
    return "$" + (number / 1e9).toFixed(2) + "B";
  }

  if (number >= 1e6) {
    return "$" + (number / 1e6).toFixed(2) + "M";
  }

  if (number >= 1e3) {
    return "$" + (number / 1e3).toFixed(2) + "K";
  }

  return formatCurrency(number);
}

function formatPrice(value) {
  const number = Number(value) || 0;

  if (number >= 1) {
    return formatCurrency(number);
  }

  return (
    "$" +
    number.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
    })
  );
}

function formatQuantity(value) {
  const number = Number(value) || 0;

  if (number >= 1) {
    return number.toFixed(4);
  }

  return number.toFixed(8);
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

function App() {
  const [coins, setCoins] = useState([]);
  const [apiPage, setApiPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [activeView, setActiveView] = useState("overview");

  const [selectedCoin, setSelectedCoin] = useState(null);
  const selectedCoinRef = useRef(null);
  const [chartData, setChartData] = useState([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState("");

  const [account, setAccount] = useState(() => {
    const savedAccount = localStorage.getItem(ACCOUNT_KEY);

    if (!savedAccount) {
      return null;
    }

    try {
      return JSON.parse(savedAccount);
    } catch {
      localStorage.removeItem(ACCOUNT_KEY);
      return null;
    }
  });
  const [accountSetupOpen, setAccountSetupOpen] = useState(false);
  const [accountForm, setAccountForm] = useState({
    firstName: "",
    lastName: "",
  });

  const [tradeModal, setTradeModal] = useState({
    open: false,
    type: "",
    coin: null,
  });

  const [tradeQuantity, setTradeQuantity] = useState("");

  /* =========================================
     SAVE ACCOUNT
     ========================================= */

  useEffect(() => {
    if (account) {
      localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
    }
  }, [account]);

  /* =========================================
     FETCH COINS
     ========================================= */

  const fetchCoins = useCallback(async (page = 1, append = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError("");
      }

      const url =
        API_URL +
        "?vs_currency=usd" +
        "&order=market_cap_desc" +
        "&per_page=" +
        API_PER_PAGE +
        "&page=" +
        page +
        "&sparkline=false" +
        "&price_change_percentage=24h";

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          "Unable to load cryptocurrency data. Please try again."
        );
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        throw new Error("Invalid cryptocurrency data received.");
      }

      if (append) {
        setCoins((previous) => [...previous, ...data]);
      } else {
        setCoins(data);

        if (!selectedCoinRef.current && data.length > 0) {
          openChart(data[0]);
        }
      }

      setApiPage(page);
    } catch (err) {
      setError(
        err.message ||
          "Unable to load cryptocurrency data. Please try again."
      );
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = setTimeout(() => {
      fetchCoins(1, false);
    }, 0);

    const interval = setInterval(() => {
      fetchCoins(1, false);
    }, 60000);

    return () => {
      clearTimeout(initialLoad);
      clearInterval(interval);
    };
  }, [fetchCoins]);

  /* =========================================
     LOAD MORE
     ========================================= */

  function handleLoadMore() {
    fetchCoins(apiPage + 1, true);
  }

  /* =========================================
     REFRESH
     ========================================= */

  function handleRefresh() {
    fetchCoins(1, false);
  }

  /* =========================================
     FILTER COINS
     ========================================= */

  const filteredCoins = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) {
      return coins;
    }

    return coins.filter((coin) => {
      return (
        coin.name.toLowerCase().includes(value) ||
        coin.symbol.toLowerCase().includes(value)
      );
    });
  }, [coins, search]);

  /* =========================================
     CREATE ACCOUNT
     ========================================= */

  function getAccountFullName(accountData) {
    const firstName = (accountData?.firstName || "").trim();
    const lastName = (accountData?.lastName || "").trim();

    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    }

    if (firstName) {
      return firstName;
    }

    if (lastName) {
      return lastName;
    }

    return "BitPulse Demo Account";
  }

  function closeAccountSetup() {
    setAccountSetupOpen(false);
    setAccountForm({ firstName: "", lastName: "" });
  }

  function createAccount(firstNameOverride, lastNameOverride) {
    const firstName = (firstNameOverride ?? accountForm.firstName).trim();
    const lastName = (lastNameOverride ?? accountForm.lastName).trim();

    if (!firstName || !lastName) {
      alert("Please enter both your first name and last name.");
      return;
    }

    const enteredName = `${firstName} ${lastName}`.trim();
    const savedAccount = localStorage.getItem(ACCOUNT_KEY);

    if (savedAccount) {
      try {
        const existingAccount = JSON.parse(savedAccount);
        const existingName = getAccountFullName(existingAccount);

        if (
          existingName.toLowerCase() === enteredName.toLowerCase()
        ) {
          setAccount(existingAccount);
          closeAccountSetup();
          alert("An account with this name already exists.");
          return;
        }
      } catch {
        localStorage.removeItem(ACCOUNT_KEY);
      }
    }

    const newAccount = {
      firstName,
      lastName,
      name: getAccountFullName({ firstName, lastName }),
      balance: INITIAL_BALANCE,
      holdings: {},
      transactions: [],
      createdAt: new Date().toISOString(),
    };

    setAccount(newAccount);
    closeAccountSetup();
  }

  /* =========================================
     RESET ACCOUNT
     ========================================= */

  function resetAccount() {
    const confirmed = window.confirm(
      "Are you sure you want to reset your demo account?"
    );

    if (!confirmed) {
      return;
    }

    const firstName = (account?.firstName || "").trim();
    const lastName = (account?.lastName || "").trim();

    const newAccount = {
      firstName,
      lastName,
      name: getAccountFullName({
        firstName,
        lastName,
      }),
      balance: INITIAL_BALANCE,
      holdings: {},
      transactions: [],
      createdAt: new Date().toISOString(),
    };

    setAccount(newAccount);
  }

  /* =========================================
     OPEN CHART
     ========================================= */

  async function openChart(coin) {
    selectedCoinRef.current = coin;
    setSelectedCoin(coin);
    setChartData([]);
    setChartError("");
    setChartLoading(true);

    try {
      const chartUrl =
        CHART_API +
        "/" +
        coin.id +
        "/market_chart?vs_currency=usd&days=365&interval=daily";

      const response = await fetch(chartUrl);

      if (!response.ok) {
        throw new Error(
          "Unable to load historical chart data. CoinGecko may be temporarily rate-limiting requests."
        );
      }

      const data = await response.json();

      if (!data.prices || !Array.isArray(data.prices)) {
        throw new Error("No historical price data available.");
      }

      const formattedData = data.prices.map((item) => {
        return {
          timestamp: item[0],
          date: formatDate(item[0]),
          price: item[1],
        };
      });

      setChartData(formattedData);
    } catch (err) {
      setChartError(
        err.message || "Unable to load chart data."
      );
    } finally {
      setChartLoading(false);
    }
  }

  /* =========================================
     CLOSE CHART
     ========================================= */

  function closeChart() {
    selectedCoinRef.current = null;
    setSelectedCoin(null);
    setChartData([]);
    setChartError("");
  }

  /* =========================================
     OPEN TRADE MODAL
     ========================================= */

  function openTrade(type, coin, event) {
    if (event) {
      event.stopPropagation();
    }

    if (!account) {
      alert("Please create your demo account first.");
      return;
    }

    setTradeQuantity("");

    setTradeModal({
      open: true,
      type,
      coin,
    });
  }

  /* =========================================
     CLOSE TRADE MODAL
     ========================================= */

  function closeTradeModal() {
    setTradeModal({
      open: false,
      type: "",
      coin: null,
    });

    setTradeQuantity("");
  }

  /* =========================================
     BUY
     ========================================= */

  function handleBuy() {
    if (!account || !tradeModal.coin) {
      return;
    }

    const quantity = Number(tradeQuantity);
    const coin = tradeModal.coin;

    if (!quantity || quantity <= 0) {
      alert("Please enter a valid quantity.");
      return;
    }

    const total = quantity * coin.current_price;

    if (total > account.balance) {
      alert("Insufficient demo balance.");
      return;
    }

    const oldHolding = account.holdings[coin.id] || {
      coinId: coin.id,
      name: coin.name,
      symbol: coin.symbol,
      image: coin.image,
      quantity: 0,
      averagePrice: 0,
    };

    const oldQuantity = Number(oldHolding.quantity) || 0;
    const oldAveragePrice = Number(oldHolding.averagePrice) || 0;

    const newQuantity = oldQuantity + quantity;

    const newAveragePrice =
      newQuantity > 0
        ? (oldQuantity * oldAveragePrice + total) / newQuantity
        : coin.current_price;

    const updatedHolding = {
      ...oldHolding,
      coinId: coin.id,
      name: coin.name,
      symbol: coin.symbol,
      image: coin.image,
      quantity: newQuantity,
      averagePrice: newAveragePrice,
    };

    const transaction = {
      id: Date.now(),
      type: "BUY",
      coinId: coin.id,
      name: coin.name,
      symbol: coin.symbol,
      quantity,
      price: coin.current_price,
      total,
      date: new Date().toISOString(),
    };

    setAccount((previous) => ({
      ...previous,
      balance: previous.balance - total,
      holdings: {
        ...previous.holdings,
        [coin.id]: updatedHolding,
      },
      transactions: [
        transaction,
        ...previous.transactions,
      ],
    }));

    closeTradeModal();
  }

  /* =========================================
     SELL
     ========================================= */

  function handleSell() {
    if (!account || !tradeModal.coin) {
      return;
    }

    const quantity = Number(tradeQuantity);
    const coin = tradeModal.coin;

    if (!quantity || quantity <= 0) {
      alert("Please enter a valid quantity.");
      return;
    }

    const holding = account.holdings[coin.id];

    if (!holding || Number(holding.quantity) <= 0) {
      alert("You don't own this cryptocurrency.");
      return;
    }

    const ownedQuantity = Number(holding.quantity);

    if (quantity > ownedQuantity) {
      alert("You don't have enough coins to sell.");
      return;
    }

    const total = quantity * coin.current_price;

    const remainingQuantity = ownedQuantity - quantity;

    const newHoldings = {
      ...account.holdings,
    };

    if (remainingQuantity <= 0.000000001) {
      delete newHoldings[coin.id];
    } else {
      newHoldings[coin.id] = {
        ...holding,
        quantity: remainingQuantity,
      };
    }

    const transaction = {
      id: Date.now(),
      type: "SELL",
      coinId: coin.id,
      name: coin.name,
      symbol: coin.symbol,
      quantity,
      price: coin.current_price,
      total,
      date: new Date().toISOString(),
    };

    setAccount((previous) => ({
      ...previous,
      balance: previous.balance + total,
      holdings: newHoldings,
      transactions: [
        transaction,
        ...previous.transactions,
      ],
    }));

    closeTradeModal();
  }

  /* =========================================
     PORTFOLIO CALCULATIONS
     ========================================= */

  const holdingsArray = useMemo(() => {
    if (!account) {
      return [];
    }

    return Object.values(account.holdings || {});
  }, [account]);

  const portfolioValue = useMemo(() => {
    if (!account) {
      return 0;
    }

    return holdingsArray.reduce((total, holding) => {
      const liveCoin = coins.find(
        (coin) => coin.id === holding.coinId
      );

      const currentPrice = liveCoin
        ? Number(liveCoin.current_price)
        : Number(holding.averagePrice);

      return total + Number(holding.quantity) * currentPrice;
    }, 0);
  }, [account, holdingsArray, coins]);

  const totalAccountValue = account
    ? Number(account.balance) + portfolioValue
    : 0;

  const totalProfitLoss = useMemo(() => {
    if (!account) {
      return 0;
    }

    return holdingsArray.reduce((total, holding) => {
      const liveCoin = coins.find(
        (coin) => coin.id === holding.coinId
      );

      if (!liveCoin) {
        return total;
      }

      const currentValue =
        Number(holding.quantity) *
        Number(liveCoin.current_price);

      const investedValue =
        Number(holding.quantity) *
        Number(holding.averagePrice);

      return total + currentValue - investedValue;
    }, 0);
  }, [account, holdingsArray, coins]);

  const marketHighlights = useMemo(() => {
    return coins.slice(0, 4).map((coin) => ({
      id: coin.id,
      name: coin.name,
      symbol: coin.symbol,
      price: coin.current_price,
      change: Number(coin.price_change_percentage_24h || 0),
      image: coin.image,
    }));
  }, [coins]);

  const trendOutlook = useMemo(() => {
    const prices = chartData
      .map((point) => Number(point.price))
      .filter((price) => Number.isFinite(price) && price > 0);

    if (prices.length < 8) {
      return null;
    }

    const previousPrice = prices[prices.length - 8];
    const latestPrice = prices[prices.length - 1];
    const change = ((latestPrice - previousPrice) / previousPrice) * 100;

    return {
      change,
      direction: change > 0.5 ? "upward" : change < -0.5 ? "downward" : "flat",
    };
  }, [chartData]);

  function navigateToView(view) {
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* =========================================
     RENDER
     ========================================= */

  return (
    <div className="app">
      {/* =====================================
          HEADER
          ===================================== */}

      <header className="top-header">
        <div className="brand">
          <div className="brand-icon">₿</div>

          <h1>BitPulse</h1>
        </div>

        <nav className="main-nav">
          <button
            type="button"
            className={activeView === "overview" ? "active" : ""}
            aria-current={activeView === "overview" ? "page" : undefined}
            onClick={() => navigateToView("overview")}
          >
            Overview
          </button>
          <button
            type="button"
            className={activeView === "markets" ? "active" : ""}
            aria-current={activeView === "markets" ? "page" : undefined}
            onClick={() => navigateToView("markets")}
          >
            Markets
          </button>
          <button
            type="button"
            className={activeView === "trade" ? "active" : ""}
            aria-current={activeView === "trade" ? "page" : undefined}
            onClick={() => navigateToView("trade")}
          >
            Trade
          </button>
          <button
            type="button"
            className={activeView === "portfolio" ? "active" : ""}
            aria-current={activeView === "portfolio" ? "page" : undefined}
            onClick={() => navigateToView("portfolio")}
          >
            Portfolio
          </button>
        </nav>

        <div className="header-status">
          <span className="live-dot"></span>
          Live Market
          <div className="user-pill">
            {account ? getAccountFullName(account) : "Demo User"}
          </div>
          <span className="developer-name developer-name-header">
            Developed by Omkar Deokar
          </span>
        </div>
      </header>

      <main className="container" data-active-view={activeView}>
        {accountSetupOpen && (
          <div
            className="modal-overlay"
            onClick={closeAccountSetup}
          >
            <div
              className="modal account-setup-modal"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                className="modal-close"
                onClick={closeAccountSetup}
              >
                ✕
              </button>

              <div className="section-label">
                CREATE DEMO ACCOUNT
              </div>

              <h2>Welcome to BitPulse</h2>

              <p className="setup-copy">
                Enter your details to open your demo trading account.
              </p>

              <div className="setup-fields">
                <label htmlFor="first-name">First Name</label>
                <input
                  id="first-name"
                  type="text"
                  value={accountForm.firstName}
                  onChange={(event) =>
                    setAccountForm((previous) => ({
                      ...previous,
                      firstName: event.target.value,
                    }))
                  }
                  placeholder="Enter first name"
                />

                <label htmlFor="last-name">Last Name</label>
                <input
                  id="last-name"
                  type="text"
                  value={accountForm.lastName}
                  onChange={(event) =>
                    setAccountForm((previous) => ({
                      ...previous,
                      lastName: event.target.value,
                    }))
                  }
                  placeholder="Enter last name"
                />
              </div>

              <button
                className="primary-btn full-width"
                onClick={() =>
                  createAccount(
                    accountForm.firstName,
                    accountForm.lastName
                  )
                }
              >
                Open Demo Account
              </button>
            </div>
          </div>
        )}

        {/* =====================================
            ACCOUNT
            ===================================== */}

        <section className="account-section" id="overview">
          {!account ? (
            <div className="account-card no-account">
              <div className="section-label">
                DEMO TRADING ACCOUNT
              </div>

              <h2>Start Demo Trading</h2>

              <p>
                Create your free demo account with $10,000
                virtual balance.
              </p>

              <button
                className="primary-btn"
                onClick={() => setAccountSetupOpen(true)}
              >
                Create Demo Account
              </button>
            </div>
          ) : (
            <div className="account-card">
              <div className="section-label">
                DEMO ACCOUNT
              </div>

              <div className="account-info">
                <div>
                  <h2>{account.name}</h2>

                  <p>
                    Virtual cryptocurrency trading account
                  </p>

                  <div className="account-owner">
                    {getAccountFullName(account)}
                  </div>
                </div>

                <div className="account-actions">
                  <button
                    className="secondary-btn"
                    onClick={resetAccount}
                  >
                    Reset Account
                  </button>
                </div>
              </div>

              <div className="portfolio-grid">
                <div className="portfolio-card">
                  <span>Available Balance</span>

                  <strong>
                    {formatCurrency(account.balance)}
                  </strong>
                </div>

                <div className="portfolio-card">
                  <span>Portfolio Value</span>

                  <strong>
                    {formatCurrency(portfolioValue)}
                  </strong>
                </div>

                <div className="portfolio-card">
                  <span>Total Account Value</span>

                  <strong>
                    {formatCurrency(totalAccountValue)}
                  </strong>
                </div>

                <div className="portfolio-card">
                  <span>Profit / Loss</span>

                  <strong
                    className={
                      totalProfitLoss >= 0
                        ? "positive"
                        : "negative"
                    }
                  >
                    {totalProfitLoss >= 0 ? "+" : ""}
                    {formatCurrency(totalProfitLoss)}
                  </strong>
                </div>
              </div>

              <div className="profit-loss-summary">
                <div className="summary-box">
                  <span>Current Profit</span>
                  <strong className={totalProfitLoss >= 0 ? "positive" : "negative"}>
                    {totalProfitLoss >= 0 ? "+" : "-"}
                    {formatCurrency(Math.abs(totalProfitLoss))}
                  </strong>
                </div>
                <div className="summary-box">
                  <span>Market Status</span>
                  <strong className={totalProfitLoss >= 0 ? "positive" : "negative"}>
                    {totalProfitLoss >= 0 ? "In Profit" : "In Loss"}
                  </strong>
                </div>
              </div>

            </div>
          )}
        </section>

        <section className="overview-highlights">
          <div className="market-hero">
            <div className="hero-copy">
              <span className="eyebrow">Crypto Market</span>
              <h2>Buy Bitcoin &amp; top crypto assets</h2>
            </div>
            <div className="hero-mini-grid">
              {marketHighlights.map((coin) => (
                <div className="mini-coin-card" key={coin.id}>
                  <div className="mini-coin-header">
                    <img src={coin.image} alt={coin.name} />
                    <div>
                      <strong>{coin.symbol.toUpperCase()}</strong>
                      <span>{coin.name}</span>
                    </div>
                  </div>
                  <div className="mini-coin-price">{formatPrice(coin.price)}</div>
                  <div className={coin.change >= 0 ? "positive" : "negative"}>
                    {coin.change >= 0 ? "+" : ""}
                    {coin.change.toFixed(2)}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          <section className="prediction-panel" aria-live="polite">
            <div className="prediction-copy">
              <span className="prediction-eyebrow">7-day trend outlook</span>
              <h2>{selectedCoin ? `${selectedCoin.name} momentum` : "Market momentum"}</h2>
              <p>
                {!selectedCoin || chartLoading
                  ? "Loading recent price history..."
                  : chartError
                    ? "Recent price history is unavailable."
                    : trendOutlook
                      ? trendOutlook.direction === "upward"
                        ? "Recent price movement is trending upward."
                        : trendOutlook.direction === "downward"
                          ? "Recent price movement is trending downward."
                          : "Recent price movement is mostly flat."
                      : "Not enough recent price data to estimate momentum."}
              </p>
            </div>
            <div
              className={`prediction-signal ${trendOutlook?.direction || "unavailable"}`}
            >
              <span>
                {trendOutlook
                  ? trendOutlook.direction
                  : "Unavailable"}
              </span>
              {trendOutlook && (
                <strong>
                  {trendOutlook.change >= 0 ? "+" : ""}
                  {trendOutlook.change.toFixed(2)}%
                </strong>
              )}
            </div>
            <p className="prediction-disclaimer">
              Historical momentum only; this is not a reliable forecast or financial advice.
            </p>
          </section>
        </section>

        {/* =====================================
            MARKET
            ===================================== */}

        <section className="market-section" id="markets">
          <div className="market-header">
            <div className="market-label">
              <h2>Cryptocurrency Market</h2>

              <span>{coins.length} Coins</span>
            </div>

            <div className="market-actions">
              <button
                className="refresh-btn"
                onClick={handleRefresh}
                disabled={loading}
              >
                🔄 Refresh
              </button>
            </div>
          </div>

          {/* SEARCH */}

          <div className="search-container">
            <input
              type="text"
              placeholder="Search cryptocurrency..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </div>

          {/* ERROR */}

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className={`market-layout ${selectedCoin ? "has-chart" : ""}`}>
            <div className="coin-panel">
              {loading ? (
                <div className="loading-box">
                  <div className="spinner"></div>

                  <p>Loading cryptocurrency market...</p>
                </div>
              ) : filteredCoins.length === 0 ? (
                <div className="empty-box">
                  No cryptocurrencies found.
                </div>
              ) : (
                <>
                  <div className="coin-grid">
                    {filteredCoins.map((coin) => {
                      const change =
                        Number(
                          coin.price_change_percentage_24h
                        ) || 0;

                      return (
                        <div
                          className="coin-card"
                          key={coin.id}
                          onClick={() => openChart(coin)}
                        >
                          <div className="coin-top">
                            <div className="coin-info">
                              <img
                                className="coin-image"
                                src={coin.image}
                                alt={coin.name}
                              />

                              <div>
                                <div className="rank">
                                  #{coin.market_cap_rank || "-"}
                                </div>

                                <div className="coin-name">
                                  {coin.name}
                                </div>

                                <div className="coin-symbol">
                                  {coin.symbol}
                                </div>
                              </div>
                            </div>

                            <div
                              className={
                                change >= 0
                                  ? "positive coin-change"
                                  : "negative coin-change"
                              }
                            >
                              {change >= 0 ? "+" : ""}
                              {change.toFixed(2)}%
                            </div>
                          </div>

                          <div className="coin-price">
                            {formatPrice(coin.current_price)}
                          </div>

                          <div className="coin-stats">
                            <div className="coin-stat">
                              <span>Market Cap</span>

                              <strong>
                                {formatCompactNumber(
                                  coin.market_cap
                                )}
                              </strong>
                            </div>

                            <div className="coin-stat">
                              <span>Volume</span>

                              <strong>
                                {formatCompactNumber(
                                  coin.total_volume
                                )}
                              </strong>
                            </div>
                          </div>

                          <div className="coin-actions">
                            <button
                              className="buy-btn"
                              onClick={(event) =>
                                openTrade(
                                  "BUY",
                                  coin,
                                  event
                                )
                              }
                            >
                              Buy
                            </button>

                            <button
                              className="sell-btn"
                              onClick={(event) =>
                                openTrade(
                                  "SELL",
                                  coin,
                                  event
                                )
                              }
                            >
                              Sell
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {!search && (
                    <div className="load-more-container">
                      <button
                        className="load-more-btn"
                        onClick={handleLoadMore}
                        disabled={loadingMore}
                      >
                        {loadingMore
                          ? "Loading..."
                          : "Load More"}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {selectedCoin && (
              <div className="chart-overlay inline-chart-overlay">
                <div
                  className="chart-panel"
                >
                  <div className="chart-section full-chart-section">
                    <div className="chart-header">
                      <div>
                        <div className="chart-title">
                          <img
                            src={selectedCoin.image}
                            alt={selectedCoin.name}
                          />

                          <div>
                            <h3>{selectedCoin.name}</h3>

                            <p>
                              {selectedCoin.symbol.toUpperCase()} ·
                              1 YEAR PRICE HISTORY
                            </p>
                          </div>
                        </div>

                        <div className="chart-price">
                          {formatPrice(
                            selectedCoin.current_price
                          )}
                        </div>
                      </div>

                      <button
                        className="close-chart"
                        onClick={closeChart}
                        aria-label="Close chart"
                      >
                        ✕
                      </button>

                    </div>

                    <div className="chart-metrics">
                      <div className="chart-metric">
                        <span>24h Change</span>
                        <strong
                          className={
                            Number(selectedCoin.price_change_percentage_24h) >= 0
                              ? "positive"
                              : "negative"
                          }
                        >
                          {Number(selectedCoin.price_change_percentage_24h || 0) >= 0
                            ? "+"
                            : ""}
                          {Number(selectedCoin.price_change_percentage_24h || 0).toFixed(2)}%
                        </strong>
                      </div>

                      <div className="chart-metric">
                        <span>Market Cap</span>
                        <strong>
                          {formatCompactNumber(selectedCoin.market_cap)}
                        </strong>
                      </div>

                      <div className="chart-metric">
                        <span>Volume</span>
                        <strong>
                          {formatCompactNumber(selectedCoin.total_volume)}
                        </strong>
                      </div>
                    </div>

                    {chartLoading ? (
                      <div className="chart-loading">
                        Loading historical price data...
                      </div>
                    ) : chartError ? (
                      <div className="chart-error">
                        {chartError}
                      </div>
                    ) : chartData.length > 0 ? (
                      <div className="chart-container full-chart-container">
                        <ResponsiveContainer
                          width="100%"
                          height="100%"
                        >
                          <LineChart data={chartData}>
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="rgba(148,163,184,0.12)"
                            />

                            <XAxis
                              dataKey="date"
                              stroke="#64748b"
                              tick={{
                                fill: "#94a3b8",
                                fontSize: 11,
                              }}
                              minTickGap={35}
                            />

                            <YAxis
                              stroke="#64748b"
                              tick={{
                                fill: "#94a3b8",
                                fontSize: 11,
                              }}
                              tickFormatter={(value) =>
                                formatPrice(value)
                              }
                            />

                            <Tooltip
                              contentStyle={{
                                background: "#0f172a",
                                border:
                                  "1px solid rgba(148,163,184,0.2)",
                                borderRadius: "10px",
                                color: "#fff",
                              }}
                              labelStyle={{
                                color: "#94a3b8",
                              }}
                              formatter={(value) => [
                                formatPrice(value),
                                "Price",
                              ]}
                            />

                            <Line
                              type="monotone"
                              dataKey="price"
                              stroke="#3b82f6"
                              strokeWidth={3}
                              dot={false}
                              activeDot={{
                                r: 5,
                              }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="chart-loading">
                        No chart data available.
                      </div>
                    )}

                    <div className="chart-actions">
                      <button
                        className="buy-btn chart-action-btn"
                        onClick={(event) => openTrade("BUY", selectedCoin, event)}
                      >
                        Buy
                      </button>
                      <button
                        className="sell-btn chart-action-btn"
                        onClick={(event) => openTrade("SELL", selectedCoin, event)}
                      >
                        Sell
                      </button>
                    </div>

                  </div>
                </div>
              </div>
            )}

            <aside className="demo-order-panel" id="trade">
              <div className="order-panel-heading">
                <div>
                  <span className="section-label">DEMO TRADING</span>
                  <h3>Order ticket</h3>
                </div>
                <span className="demo-status">VIRTUAL</span>
              </div>

              {selectedCoin ? (
                <>
                  <div className="order-asset-summary">
                    <img src={selectedCoin.image} alt="" />
                    <div>
                      <strong>{selectedCoin.symbol.toUpperCase()} / USD</strong>
                      <span>{selectedCoin.name}</span>
                    </div>
                  </div>

                  <div className="order-price-summary">
                    <span>Market price</span>
                    <strong>{formatPrice(selectedCoin.current_price)}</strong>
                  </div>

                  <div className="order-price-summary">
                    <span>24h change</span>
                    <strong
                      className={
                        Number(selectedCoin.price_change_percentage_24h || 0) >= 0
                          ? "positive"
                          : "negative"
                      }
                    >
                      {Number(selectedCoin.price_change_percentage_24h || 0) >= 0
                        ? "+"
                        : ""}
                      {Number(selectedCoin.price_change_percentage_24h || 0).toFixed(2)}%
                    </strong>
                  </div>

                  <div className="order-balance-summary">
                    <span>Available demo balance</span>
                    <strong>{formatCurrency(account?.balance || 0)}</strong>
                  </div>

                  {account ? (
                    <div className="order-action-buttons">
                      <button
                        className="buy-btn"
                        onClick={(event) => openTrade("BUY", selectedCoin, event)}
                      >
                        Buy {selectedCoin.symbol.toUpperCase()}
                      </button>
                      <button
                        className="sell-btn"
                        onClick={(event) => openTrade("SELL", selectedCoin, event)}
                      >
                        Sell {selectedCoin.symbol.toUpperCase()}
                      </button>
                    </div>
                  ) : (
                    <button
                      className="primary-btn full-width"
                      onClick={() => setAccountSetupOpen(true)}
                    >
                      Open demo account
                    </button>
                  )}

                  <p className="virtual-trading-note">
                    Orders use virtual funds and are saved only in this browser.
                  </p>
                </>
              ) : (
                <div className="order-loading">Select an asset to prepare a demo order.</div>
              )}
            </aside>
          </div>
        </section>

        {/* =====================================
            HOLDINGS
            ===================================== */}

        <section className="holdings-section" id="portfolio">
            <div className="section-heading">
              <h2>Your Holdings</h2>

              <span>
                {holdingsArray.length} asset
                {holdingsArray.length !== 1 ? "s" : ""}
              </span>
            </div>

            {holdingsArray.length > 0 ? (
            <div className="holdings-table-wrapper">
              <table className="holdings-table">
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Quantity</th>
                    <th>Average Price</th>
                    <th>Current Value</th>
                    <th>P/L</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {holdingsArray.map((holding) => {
                    const liveCoin = coins.find(
                      (coin) =>
                        coin.id === holding.coinId
                    );

                    const currentPrice = liveCoin
                      ? Number(liveCoin.current_price)
                      : Number(holding.averagePrice);

                    const currentValue =
                      Number(holding.quantity) *
                      currentPrice;

                    const investedValue =
                      Number(holding.quantity) *
                      Number(holding.averagePrice);

                    const profitLoss =
                      currentValue - investedValue;

                    return (
                      <tr key={holding.coinId}>
                        <td>
                          <div className="table-coin">
                            <img
                              src={holding.image}
                              alt={holding.name}
                            />

                            <div>
                              <strong>
                                {holding.name}
                              </strong>

                              <span>
                                {holding.symbol}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td>
                          {formatQuantity(
                            holding.quantity
                          )}
                        </td>

                        <td>
                          {formatPrice(
                            holding.averagePrice
                          )}
                        </td>

                        <td>
                          {formatCurrency(currentValue)}
                        </td>

                        <td
                          className={
                            profitLoss >= 0
                              ? "positive"
                              : "negative"
                          }
                        >
                          {profitLoss >= 0 ? "+" : ""}
                          {formatCurrency(profitLoss)}
                        </td>

                        <td>
                          <button
                            className="sell-table-btn"
                            onClick={(event) =>
                              openTrade(
                                "SELL",
                                {
                                  ...liveCoin,
                                  id: holding.coinId,
                                  name: holding.name,
                                  symbol: holding.symbol,
                                  image: holding.image,
                                  current_price:
                                    currentPrice,
                                },
                                event
                              )
                            }
                          >
                            Sell
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            ) : (
              <div className="empty-portfolio">
                Your demo portfolio is empty. Choose an asset in Markets to place your first virtual order.
              </div>
            )}
        </section>

        {/* =====================================
            TRANSACTIONS
            ===================================== */}

        {account && (
          <section className="transactions-section">
            <div className="section-heading">
              <h2>Trading Record</h2>

              <span>
                {account.transactions.length} trade
                {account.transactions.length !== 1 ? "s" : ""}
              </span>
            </div>

            {account.transactions.length > 0 ? (
              <div className="transactions-list">
                {account.transactions
                  .slice(0, 20)
                  .map((transaction) => (
                    <div
                      className="transaction-item"
                      key={transaction.id}
                    >
                      <div className="transaction-left">
                        <div
                          className={
                            transaction.type === "BUY"
                              ? "transaction-icon buy-icon"
                              : "transaction-icon sell-icon"
                          }
                        >
                          {transaction.type === "BUY" ? "↑" : "↓"}
                        </div>

                        <div>
                          <strong>
                            {transaction.type}{" "}
                            {transaction.name}
                          </strong>

                          <span>
                            {new Date(
                              transaction.date
                            ).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <div className="transaction-right">
                        <strong>
                          {formatCurrency(
                            transaction.total
                          )}
                        </strong>

                        <span>
                          {formatQuantity(
                            transaction.quantity
                          )}{" "}
                          {transaction.symbol.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="empty-trade-record">
                No buying or selling activity yet. Your trade
                record will appear here after your first order.
              </div>
            )}
          </section>
        )}
      </main>

      {/* =====================================
          TRADE MODAL
          ===================================== */}

      {tradeModal.open && tradeModal.coin && (
        <div
          className="modal-overlay"
          onClick={closeTradeModal}
        >
          <div
            className="modal trade-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <button
              className="modal-close"
              onClick={closeTradeModal}
            >
              ✕
            </button>

            <img
              className="modal-icon"
              src={tradeModal.coin.image}
              alt={tradeModal.coin.name}
            />

            <h2>
              {tradeModal.type === "BUY"
                ? "Buy"
                : "Sell"}{" "}
              {tradeModal.coin.name}
            </h2>

            <p className="trade-coin">
              {tradeModal.coin.symbol.toUpperCase()}
            </p>

            <div className="trade-price">
              <span>Current Price</span>

              <strong>
                {formatPrice(
                  tradeModal.coin.current_price
                )}
              </strong>
            </div>

            {tradeModal.type === "BUY" ? (
              <div className="available-coin">
                Available balance:{" "}
                <strong>
                  {formatCurrency(account?.balance || 0)}
                </strong>
              </div>
            ) : (
              <div className="available-coin">
                Available coins:{" "}
                <strong>
                  {formatQuantity(
                    account?.holdings?.[
                      tradeModal.coin.id
                    ]?.quantity || 0
                  )}{" "}
                  {tradeModal.coin.symbol.toUpperCase()}
                </strong>
              </div>
            )}

            {tradeModal.type === "SELL" &&
              !account?.holdings?.[
                tradeModal.coin.id
              ] && (
                <div className="no-holding">
                  You don't own this cryptocurrency.
                </div>
              )}

            <label htmlFor="trade-quantity">
              Quantity
            </label>

            <input
              id="trade-quantity"
              type="number"
              min="0"
              step="any"
              placeholder="Enter quantity"
              value={tradeQuantity}
              onChange={(event) =>
                setTradeQuantity(event.target.value)
              }
            />

            <div className="trade-total">
              <span>Total Value</span>

              <strong>
                {formatCurrency(
                  (Number(tradeQuantity) || 0) *
                    Number(
                      tradeModal.coin.current_price
                    )
                )}
              </strong>
            </div>

            {tradeModal.type === "BUY" ? (
              <button
                className="buy-submit"
                onClick={handleBuy}
                disabled={
                  !tradeQuantity ||
                  Number(tradeQuantity) <= 0
                }
              >
                Confirm Buy
              </button>
            ) : (
              <button
                className="sell-submit"
                onClick={handleSell}
                disabled={
                  !tradeQuantity ||
                  Number(tradeQuantity) <= 0 ||
                  !account?.holdings?.[
                    tradeModal.coin.id
                  ]
                }
              >
                Confirm Sell
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;