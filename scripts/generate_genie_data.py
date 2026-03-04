# Databricks notebook source
# MAGIC %md
# MAGIC # Equity Research Intelligence — Synthetic Data Generator
# MAGIC
# MAGIC Generates 9 tables in `ananyaroy.agents` for the Genie Room powering
# MAGIC the "Equity Research Intelligence" panel. ~36K rows covering ~30 companies
# MAGIC across 6 sectors over 2 years (2024-2026).
# MAGIC
# MAGIC **Run order matters** — cells are ordered by dependency chain.

# COMMAND ----------

import random
import math
import json
from datetime import date, timedelta, datetime
from collections import defaultdict

import pandas as pd
import numpy as np

random.seed(42)
np.random.seed(42)

CATALOG = "ananyaroy"
SCHEMA = "agents"
FULL = f"{CATALOG}.{SCHEMA}"

# Trading date range
START_DATE = date(2024, 1, 2)   # first trading day 2024
END_DATE   = date(2026, 2, 27)  # late Feb 2026

# COMMAND ----------
# MAGIC %md
# MAGIC ## 1. `company_profile` — Master dimension table (~30 rows)

# COMMAND ----------

COMPANIES = [
    # ticker, company_name, sector, sub_industry, market_cap_B, shares_mm, div_yield_pct, sp500_wt_pct, fy_end_month, ceo, employees_k
    ("AAPL",  "Apple Inc.",                     "Technology",   "Technology Hardware",       3400, 15200, 0.5,  7.1, 9,  "Tim Cook",           164),
    ("MSFT",  "Microsoft Corporation",          "Technology",   "Systems Software",          3100, 7430,  0.7,  6.8, 6,  "Satya Nadella",      228),
    ("NVDA",  "NVIDIA Corporation",             "Technology",   "Semiconductors",            3200, 24500, 0.02, 6.5, 1,  "Jensen Huang",       32),
    ("GOOGL", "Alphabet Inc.",                  "Technology",   "Interactive Media",         2100, 12300, 0.0,  4.2, 12, "Sundar Pichai",      182),
    ("META",  "Meta Platforms Inc.",            "Technology",   "Interactive Media",         1500, 2530,  0.0,  2.5, 12, "Mark Zuckerberg",    67),
    ("AVGO",  "Broadcom Inc.",                  "Technology",   "Semiconductors",            800,  4650,  1.3,  1.6, 10, "Hock Tan",           20),
    ("AMD",   "Advanced Micro Devices Inc.",    "Technology",   "Semiconductors",            280,  1620,  0.0,  0.6, 12, "Lisa Su",            26),
    ("INTC",  "Intel Corporation",              "Technology",   "Semiconductors",            110,  4260,  1.5,  0.2, 12, "Pat Gelsinger",      124),

    ("JNJ",   "Johnson & Johnson",              "Healthcare",   "Pharmaceuticals",           390,  2410,  3.0,  0.8, 12, "Joaquin Duato",      131),
    ("UNH",   "UnitedHealth Group Inc.",        "Healthcare",   "Managed Health Care",       530,  920,   1.4,  1.1, 12, "Andrew Witty",       400),
    ("PFE",   "Pfizer Inc.",                    "Healthcare",   "Pharmaceuticals",           150,  5630,  5.8,  0.3, 12, "Albert Bourla",      83),
    ("ABBV",  "AbbVie Inc.",                    "Healthcare",   "Biotechnology",             340,  1770,  3.5,  0.7, 12, "Robert Michael",     50),
    ("MRK",   "Merck & Co. Inc.",              "Healthcare",   "Pharmaceuticals",           310,  2530,  2.5,  0.6, 12, "Robert Davis",       69),
    ("LLY",   "Eli Lilly and Company",          "Healthcare",   "Pharmaceuticals",           800,  950,   0.6,  1.7, 12, "David Ricks",        43),

    ("XOM",   "Exxon Mobil Corporation",        "Energy",       "Integrated Oil & Gas",      510,  4190,  3.3,  1.0, 12, "Darren Woods",       62),
    ("CVX",   "Chevron Corporation",            "Energy",       "Integrated Oil & Gas",      300,  1830,  4.0,  0.6, 12, "Mike Wirth",         43),
    ("COP",   "ConocoPhillips",                 "Energy",       "Oil & Gas E&P",             140,  1160,  1.8,  0.3, 12, "Ryan Lance",         10),
    ("SLB",   "Schlumberger Limited",           "Energy",       "Oil & Gas Equipment",       66,   1420,  2.3,  0.1, 12, "Olivier Le Peuch",   99),
    ("EOG",   "EOG Resources Inc.",             "Energy",       "Oil & Gas E&P",             75,   570,   2.5,  0.2, 12, "Ezra Yacob",         3),

    ("JPM",   "JPMorgan Chase & Co.",           "Financials",   "Diversified Banks",         680,  2860,  2.1,  1.4, 12, "Jamie Dimon",        309),
    ("BAC",   "Bank of America Corporation",    "Financials",   "Diversified Banks",         350,  7870,  2.4,  0.7, 12, "Brian Moynihan",     213),
    ("GS",    "Goldman Sachs Group Inc.",       "Financials",   "Investment Banking",        180,  330,   2.3,  0.4, 12, "David Solomon",      46),
    ("MS",    "Morgan Stanley",                 "Financials",   "Investment Banking",        200,  1620,  3.2,  0.4, 12, "Ted Pick",           82),
    ("BLK",   "BlackRock Inc.",                 "Financials",   "Asset Management",          150,  148,   2.2,  0.3, 12, "Larry Fink",         20),

    ("AMZN",  "Amazon.com Inc.",                "Consumer",     "Broadline Retail",          2100, 10400, 0.0,  4.0, 12, "Andy Jassy",         1540),
    ("TSLA",  "Tesla Inc.",                     "Consumer",     "Automobile Manufacturers",  800,  3200,  0.0,  1.6, 12, "Elon Musk",          140),
    ("HD",    "The Home Depot Inc.",            "Consumer",     "Home Improvement Retail",   390,  996,   2.4,  0.8, 1,  "Ted Decker",         475),
    ("NKE",   "NIKE Inc.",                      "Consumer",     "Footwear",                  120,  1490,  1.8,  0.2, 5,  "Elliott Hill",       80),
    ("DIS",   "The Walt Disney Company",        "Consumer",     "Movies & Entertainment",    210,  1830,  0.8,  0.4, 9,  "Bob Iger",           225),
    ("NFLX",  "Netflix Inc.",                   "Consumer",     "Movies & Entertainment",    380,  430,   0.0,  0.8, 12, "Ted Sarandos",       14),

    ("BA",    "The Boeing Company",             "Industrials",  "Aerospace & Defense",       130,  615,   0.0,  0.3, 12, "Kelly Ortberg",      170),
    ("CAT",   "Caterpillar Inc.",               "Industrials",  "Construction Machinery",    190,  487,   1.5,  0.4, 12, "Jim Umpleby",        115),
    ("GE",    "GE Aerospace",                   "Industrials",  "Aerospace & Defense",       200,  1090,  0.6,  0.4, 12, "Larry Culp",         53),
    ("RTX",   "RTX Corporation",                "Industrials",  "Aerospace & Defense",       160,  1310,  2.1,  0.3, 12, "Chris Calio",        185),
    ("LMT",   "Lockheed Martin Corporation",    "Industrials",  "Aerospace & Defense",       135,  236,   2.5,  0.3, 12, "Jim Taiclet",        122),
]

company_rows = []
for c in COMPANIES:
    company_rows.append({
        "ticker": c[0],
        "company_name": c[1],
        "sector": c[2],
        "sub_industry": c[3],
        "market_cap_billions": float(c[4]),
        "shares_outstanding_mm": float(c[5]),
        "dividend_yield_pct": float(c[6]),
        "sp500_weight_pct": float(c[7]),
        "fiscal_year_end_month": int(c[8]),
        "ceo_name": c[9],
        "employees_thousands": float(c[10]),
    })

df_company = pd.DataFrame(company_rows)
print(f"company_profile: {len(df_company)} rows")
df_company.head()

# COMMAND ----------

spark.sql(f"DROP TABLE IF EXISTS {FULL}.company_profile")
sdf = spark.createDataFrame(df_company)
sdf.write.mode("overwrite").saveAsTable(f"{FULL}.company_profile")
print("✓ company_profile written")

# COMMAND ----------
# MAGIC %md
# MAGIC ## 2. `stock_price_daily` — Daily OHLCV with moving averages (~15K+ rows)

# COMMAND ----------

# Known approximate prices on 2024-01-02 (seed values)
SEED_PRICES = {
    "AAPL": 185, "MSFT": 375, "NVDA": 480, "GOOGL": 140, "META": 350,
    "AVGO": 1100, "AMD": 140, "INTC": 48,
    "JNJ": 155, "UNH": 530, "PFE": 28, "ABBV": 155, "MRK": 109, "LLY": 620,
    "XOM": 100, "CVX": 150, "COP": 117, "SLB": 52, "EOG": 120,
    "JPM": 170, "BAC": 34, "GS": 385, "MS": 86, "BLK": 810,
    "AMZN": 152, "TSLA": 250, "HD": 350, "NKE": 108, "DIS": 90, "NFLX": 490,
    "BA": 250, "CAT": 295, "GE": 130, "RTX": 85, "LMT": 460,
}

# Annual drift (expected annualized return) per ticker — shapes 2-year trajectory
ANNUAL_DRIFT = {
    "AAPL": 0.12, "MSFT": 0.15, "NVDA": 0.60, "GOOGL": 0.18, "META": 0.25,
    "AVGO": 0.35, "AMD": 0.20, "INTC": -0.15,
    "JNJ": 0.08, "UNH": 0.12, "PFE": -0.05, "ABBV": 0.10, "MRK": 0.08, "LLY": 0.40,
    "XOM": 0.05, "CVX": 0.04, "COP": 0.07, "SLB": 0.06, "EOG": 0.05,
    "JPM": 0.15, "BAC": 0.12, "GS": 0.18, "MS": 0.14, "BLK": 0.16,
    "AMZN": 0.22, "TSLA": 0.10, "HD": 0.10, "NKE": -0.05, "DIS": 0.08, "NFLX": 0.30,
    "BA": 0.05, "CAT": 0.12, "GE": 0.20, "RTX": 0.14, "LMT": 0.10,
}

# Annual volatility per ticker
ANNUAL_VOL = {
    "AAPL": 0.25, "MSFT": 0.25, "NVDA": 0.50, "GOOGL": 0.28, "META": 0.35,
    "AVGO": 0.35, "AMD": 0.45, "INTC": 0.40,
    "JNJ": 0.18, "UNH": 0.22, "PFE": 0.30, "ABBV": 0.22, "MRK": 0.20, "LLY": 0.35,
    "XOM": 0.22, "CVX": 0.22, "COP": 0.28, "SLB": 0.30, "EOG": 0.28,
    "JPM": 0.22, "BAC": 0.25, "GS": 0.28, "MS": 0.28, "BLK": 0.22,
    "AMZN": 0.30, "TSLA": 0.55, "HD": 0.22, "NKE": 0.30, "DIS": 0.28, "NFLX": 0.35,
    "BA": 0.40, "CAT": 0.25, "GE": 0.28, "RTX": 0.22, "LMT": 0.20,
}

def generate_trading_dates(start, end):
    """Generate US trading days (Mon-Fri, skip major holidays)."""
    holidays = {
        date(2024,1,1), date(2024,1,15), date(2024,2,19), date(2024,3,29),
        date(2024,5,27), date(2024,6,19), date(2024,7,4), date(2024,9,2),
        date(2024,11,28), date(2024,12,25),
        date(2025,1,1), date(2025,1,20), date(2025,2,17), date(2025,4,18),
        date(2025,5,26), date(2025,6,19), date(2025,7,4), date(2025,9,1),
        date(2025,11,27), date(2025,12,25),
        date(2026,1,1), date(2026,1,19), date(2026,2,16),
    }
    dates = []
    d = start
    while d <= end:
        if d.weekday() < 5 and d not in holidays:
            dates.append(d)
        d += timedelta(days=1)
    return dates

trading_dates = generate_trading_dates(START_DATE, END_DATE)
print(f"Trading days: {len(trading_dates)}")

# COMMAND ----------

# Generate price paths via geometric Brownian motion
dt = 1.0 / 252  # one trading day

price_data = []
for ticker in SEED_PRICES:
    mu = ANNUAL_DRIFT[ticker]
    sigma = ANNUAL_VOL[ticker]
    price = SEED_PRICES[ticker]
    prices = []

    for td in trading_dates:
        # GBM step
        shock = np.random.normal(0, 1)
        daily_ret = (mu - 0.5 * sigma**2) * dt + sigma * math.sqrt(dt) * shock

        open_price = price * (1 + np.random.normal(0, 0.002))  # slight gap
        new_price = price * math.exp(daily_ret)

        high_price = max(open_price, new_price) * (1 + abs(np.random.normal(0, 0.005)))
        low_price  = min(open_price, new_price) * (1 - abs(np.random.normal(0, 0.005)))
        close_price = new_price

        # Volume: base volume scaled by price level and volatility
        base_vol = max(5_000_000, int(50_000_000 * (100 / max(price, 1))))
        volume = int(base_vol * (1 + abs(np.random.normal(0, 0.3))))

        prices.append({
            "ticker": ticker,
            "trade_date": td,
            "open_price": round(open_price, 2),
            "high_price": round(high_price, 2),
            "low_price": round(low_price, 2),
            "close_price": round(close_price, 2),
            "volume": volume,
        })
        price = close_price

    # Compute daily returns, SMAs, volume averages
    for i, row in enumerate(prices):
        if i == 0:
            row["daily_return_pct"] = 0.0
        else:
            prev_close = prices[i-1]["close_price"]
            row["daily_return_pct"] = round(((row["close_price"] - prev_close) / prev_close) * 100, 4)

        # SMA-50
        if i >= 49:
            row["sma_50"] = round(np.mean([prices[j]["close_price"] for j in range(i-49, i+1)]), 2)
        else:
            row["sma_50"] = None

        # SMA-200
        if i >= 199:
            row["sma_200"] = round(np.mean([prices[j]["close_price"] for j in range(i-199, i+1)]), 2)
        else:
            row["sma_200"] = None

        # Volume vs 20d avg
        if i >= 19:
            avg_vol_20 = np.mean([prices[j]["volume"] for j in range(i-19, i+1)])
            row["volume_vs_20d_avg_pct"] = round((row["volume"] / avg_vol_20) * 100, 2)
        else:
            row["volume_vs_20d_avg_pct"] = 100.0

    price_data.extend(prices)

df_prices = pd.DataFrame(price_data)
print(f"stock_price_daily: {len(df_prices)} rows")
df_prices.head()

# COMMAND ----------

spark.sql(f"DROP TABLE IF EXISTS {FULL}.stock_price_daily")
sdf = spark.createDataFrame(df_prices)
sdf.write.mode("overwrite").saveAsTable(f"{FULL}.stock_price_daily")
print("✓ stock_price_daily written")

# COMMAND ----------
# MAGIC %md
# MAGIC ## 3. `quarterly_financials` — Earnings data (30 companies x 8 quarters = 240 rows)

# COMMAND ----------

# Realistic quarterly revenue ranges (in $M) and growth profiles
# (ticker, base_rev_Q1_2024, qoq_growth_pct, gross_margin, op_margin, net_margin)
FINANCIAL_SEEDS = {
    "AAPL":  (95000,  0.03, 0.46, 0.30, 0.26),
    "MSFT":  (62000,  0.05, 0.70, 0.44, 0.36),
    "NVDA":  (22000,  0.15, 0.74, 0.56, 0.50),  # rapid growth
    "GOOGL": (86000,  0.04, 0.57, 0.28, 0.24),
    "META":  (40000,  0.06, 0.82, 0.38, 0.30),
    "AVGO":  (12000,  0.06, 0.74, 0.45, 0.30),
    "AMD":   (5800,   0.05, 0.50, 0.22, 0.10),
    "INTC":  (12700,  -0.02, 0.41, 0.05, 0.02),  # struggling
    "JNJ":   (21400,  0.02, 0.69, 0.26, 0.20),
    "UNH":   (94400,  0.03, 0.24, 0.09, 0.06),
    "PFE":   (14900,  0.01, 0.62, 0.15, 0.10),
    "ABBV":  (14400,  0.03, 0.70, 0.33, 0.22),
    "MRK":   (15800,  0.03, 0.75, 0.30, 0.24),
    "LLY":   (10000,  0.08, 0.80, 0.35, 0.25),  # weight loss drug boom
    "XOM":   (83700,  0.01, 0.30, 0.14, 0.10),
    "CVX":   (48300,  0.01, 0.34, 0.15, 0.11),
    "COP":   (14600,  0.02, 0.42, 0.28, 0.20),
    "SLB":   (8900,   0.02, 0.22, 0.15, 0.10),
    "EOG":   (6300,   0.01, 0.55, 0.30, 0.22),
    "JPM":   (42000,  0.03, 0.60, 0.38, 0.30),
    "BAC":   (26000,  0.02, 0.55, 0.30, 0.24),
    "GS":    (12700,  0.04, 0.55, 0.30, 0.22),
    "MS":    (15200,  0.03, 0.55, 0.28, 0.20),
    "BLK":   (4800,   0.03, 0.52, 0.36, 0.28),
    "AMZN":  (143000, 0.04, 0.48, 0.10, 0.07),
    "TSLA":  (25000,  0.03, 0.18, 0.08, 0.05),  # lower margins
    "HD":    (37000,  0.02, 0.34, 0.15, 0.10),
    "NKE":   (12400,  0.01, 0.44, 0.12, 0.08),
    "DIS":   (22800,  0.02, 0.35, 0.12, 0.07),
    "NFLX":  (9400,   0.05, 0.45, 0.25, 0.18),
    "BA":    (18500,  0.02, 0.10, -0.02, -0.04),  # BA still losing money
    "CAT":   (16800,  0.02, 0.38, 0.22, 0.15),
    "GE":    (16100,  0.03, 0.30, 0.16, 0.10),
    "RTX":   (19500,  0.02, 0.28, 0.12, 0.08),
    "LMT":   (18000,  0.02, 0.27, 0.12, 0.10),
}

QUARTERS = [
    ("Q1 2024", 2024, date(2024, 4, 25)),
    ("Q2 2024", 2024, date(2024, 7, 25)),
    ("Q3 2024", 2024, date(2024, 10, 25)),
    ("Q4 2024", 2024, date(2025, 1, 28)),
    ("Q1 2025", 2025, date(2025, 4, 24)),
    ("Q2 2025", 2025, date(2025, 7, 24)),
    ("Q3 2025", 2025, date(2025, 10, 23)),  # future-ish
    ("Q4 2025", 2025, None),                 # estimated
]

# Segment breakdowns (JSON strings)
SEGMENTS = {
    "AAPL": '{"iPhone": 48, "Services": 24, "Mac": 10, "iPad": 8, "Wearables": 10}',
    "MSFT": '{"Intelligent Cloud": 42, "Productivity": 32, "Personal Computing": 26}',
    "NVDA": '{"Data Center": 78, "Gaming": 15, "Auto": 4, "Visualization": 3}',
    "GOOGL": '{"Search": 58, "YouTube": 10, "Cloud": 18, "Other": 14}',
    "META": '{"Family of Apps": 97, "Reality Labs": 3}',
    "AMZN": '{"AWS": 22, "Online Stores": 40, "Third-Party": 25, "Advertising": 13}',
    "TSLA": '{"Automotive": 82, "Energy": 8, "Services": 10}',
}

fin_rows = []
for ticker in SEED_PRICES:
    seed = FINANCIAL_SEEDS.get(ticker)
    if not seed:
        continue
    base_rev, qoq_g, gm, om, nm = seed
    rev = base_rev

    # Get shares outstanding for EPS
    co = next((c for c in COMPANIES if c[0] == ticker), None)
    shares_mm = co[5] if co else 1000

    for i, (qname, fy, rdate) in enumerate(QUARTERS):
        # Revenue with slight noise
        rev = rev * (1 + qoq_g + np.random.normal(0, 0.01))
        rev_actual = round(rev, 1)

        # Consensus: within +/-3% of actual (analyst estimates are close)
        rev_consensus = round(rev_actual * (1 + np.random.uniform(-0.03, 0.02)), 1)

        # Beat/miss
        rev_beat_miss = round(((rev_actual - rev_consensus) / rev_consensus) * 100, 2)

        # YoY: compare to 4 quarters ago if available
        rev_yoy = round(qoq_g * 4 * 100 + np.random.normal(0, 2), 2)

        # Margins with noise
        gm_q = round(gm + np.random.normal(0, 0.01), 4)
        om_q = round(om + np.random.normal(0, 0.01), 4)
        nm_q = round(nm + np.random.normal(0, 0.01), 4)

        op_income = round(rev_actual * om_q, 1)
        net_income = round(rev_actual * nm_q, 1)
        fcf = round(net_income * np.random.uniform(0.8, 1.3), 1)

        eps_actual = round(net_income / shares_mm, 2)
        eps_consensus = round(eps_actual * (1 + np.random.uniform(-0.04, 0.02)), 2)
        eps_beat_miss = round(((eps_actual - eps_consensus) / abs(eps_consensus)) * 100, 2) if eps_consensus != 0 else 0
        eps_yoy = round(rev_yoy + np.random.normal(0, 3), 2)

        # Guidance
        guidance_dir = np.random.choice(["raised", "maintained", "lowered", "maintained"],
                                         p=[0.3, 0.45, 0.15, 0.1])
        guid_rev_mid = rev_actual * (1 + qoq_g)
        guid_rev_low = round(guid_rev_mid * 0.97, 1)
        guid_rev_high = round(guid_rev_mid * 1.03, 1)
        guid_eps_mid = eps_actual * (1 + qoq_g)
        guid_eps_low = round(guid_eps_mid * 0.95, 2)
        guid_eps_high = round(guid_eps_mid * 1.05, 2)

        is_estimated = rdate is None or rdate > date(2025, 9, 1)

        fin_rows.append({
            "ticker": ticker,
            "fiscal_quarter": qname,
            "fiscal_year": fy,
            "report_date": rdate,
            "revenue_millions": rev_actual,
            "revenue_consensus_millions": rev_consensus,
            "revenue_yoy_growth_pct": rev_yoy,
            "revenue_beat_miss_pct": rev_beat_miss,
            "eps_actual": eps_actual,
            "eps_consensus": eps_consensus,
            "eps_beat_miss_pct": eps_beat_miss,
            "eps_yoy_growth_pct": eps_yoy,
            "gross_margin_pct": round(gm_q * 100, 2),
            "operating_margin_pct": round(om_q * 100, 2),
            "net_margin_pct": round(nm_q * 100, 2),
            "operating_income_millions": op_income,
            "net_income_millions": net_income,
            "free_cash_flow_millions": fcf,
            "guidance_revenue_low_mm": guid_rev_low,
            "guidance_revenue_high_mm": guid_rev_high,
            "guidance_eps_low": guid_eps_low,
            "guidance_eps_high": guid_eps_high,
            "guidance_direction": guidance_dir,
            "segment_breakdown": SEGMENTS.get(ticker, "{}"),
            "is_estimated": is_estimated,
        })

df_financials = pd.DataFrame(fin_rows)
print(f"quarterly_financials: {len(df_financials)} rows")
df_financials[df_financials.ticker == "NVDA"]

# COMMAND ----------

spark.sql(f"DROP TABLE IF EXISTS {FULL}.quarterly_financials")
sdf = spark.createDataFrame(df_financials)
sdf.write.mode("overwrite").saveAsTable(f"{FULL}.quarterly_financials")
print("✓ quarterly_financials written")

# COMMAND ----------
# MAGIC %md
# MAGIC ## 4. `analyst_ratings` — Sell-side ratings (~450 rows)

# COMMAND ----------

ANALYST_FIRMS = [
    ("Goldman Sachs", "GS"), ("Morgan Stanley", "MS"), ("JPMorgan", "JPM"),
    ("Bank of America", "BofA"), ("Barclays", "BARC"), ("Citi", "C"),
    ("UBS", "UBS"), ("Deutsche Bank", "DB"), ("Wells Fargo", "WF"),
    ("Raymond James", "RJ"), ("Piper Sandler", "PS"), ("Jefferies", "JEF"),
    ("Bernstein", "AB"), ("Wedbush", "WB"), ("KeyBanc", "KB"),
]

ANALYST_NAMES = [
    "Erik Woodring", "Brian Nowak", "Mark Lipacis", "Samik Chatterjee",
    "Daniel Ives", "Toshiya Hari", "Vivek Arya", "Matt Ramsay",
    "Stacy Rasgon", "Timothy Arcuri", "Amit Daryanani", "Rod Hall",
    "Benjamin Reitzes", "Karl Keirstead", "Brent Thill",
]

RATINGS = ["Strong Buy", "Buy", "Overweight", "Hold", "Underweight", "Sell"]
RATING_WEIGHTS = [0.15, 0.30, 0.20, 0.25, 0.07, 0.03]

CATALYSTS = [
    "Strong earnings beat", "Product launch momentum", "Market share gains",
    "AI revenue acceleration", "Margin expansion", "Guidance raise",
    "Regulatory tailwind", "Valuation attractive", "Earnings miss",
    "Guidance cut", "Competitive pressure", "Macro headwinds",
    "China exposure risk", "Strong FCF generation", "Dividend growth",
]

# Build a lookup for latest prices per ticker from df_prices
latest_prices = df_prices.groupby("ticker")["close_price"].last().to_dict()

rating_rows = []
for ticker in SEED_PRICES:
    curr_price = latest_prices.get(ticker, SEED_PRICES[ticker])
    # 10-18 analyst ratings per stock
    n_ratings = random.randint(10, 18)
    used_firms = random.sample(ANALYST_FIRMS, min(n_ratings, len(ANALYST_FIRMS)))

    for j, (firm_name, _) in enumerate(used_firms):
        analyst = random.choice(ANALYST_NAMES)
        rating = np.random.choice(RATINGS, p=RATING_WEIGHTS)

        # Generate price target relative to current price
        if rating in ("Strong Buy", "Buy", "Overweight"):
            pt = round(curr_price * np.random.uniform(1.05, 1.40), 2)
        elif rating == "Hold":
            pt = round(curr_price * np.random.uniform(0.95, 1.10), 2)
        else:
            pt = round(curr_price * np.random.uniform(0.70, 0.95), 2)

        # Previous rating and PT
        prev_rating = np.random.choice(RATINGS, p=RATING_WEIGHTS) if random.random() > 0.2 else None
        prev_pt = round(pt * np.random.uniform(0.85, 1.05), 2) if prev_rating else None
        pt_change = round(((pt - prev_pt) / prev_pt) * 100, 2) if prev_pt else None

        # Rating change type
        if prev_rating is None:
            change_type = "initiation"
        elif RATINGS.index(rating) < RATINGS.index(prev_rating):
            change_type = "upgrade"
        elif RATINGS.index(rating) > RATINGS.index(prev_rating):
            change_type = "downgrade"
        else:
            change_type = "reiteration"

        implied_upside = round(((pt - curr_price) / curr_price) * 100, 2)

        # Random date in 2024-2026
        days_offset = random.randint(0, (END_DATE - START_DATE).days)
        rd = START_DATE + timedelta(days=days_offset)
        # Skip weekends
        while rd.weekday() >= 5:
            rd += timedelta(days=1)

        rating_rows.append({
            "ticker": ticker,
            "analyst_firm": firm_name,
            "analyst_name": analyst,
            "rating": rating,
            "previous_rating": prev_rating,
            "rating_change_type": change_type,
            "price_target": pt,
            "previous_price_target": prev_pt,
            "price_target_change_pct": pt_change,
            "implied_upside_pct": implied_upside,
            "rating_date": rd,
            "catalyst": random.choice(CATALYSTS),
        })

df_ratings = pd.DataFrame(rating_rows)
print(f"analyst_ratings: {len(df_ratings)} rows")
df_ratings.head()

# COMMAND ----------

spark.sql(f"DROP TABLE IF EXISTS {FULL}.analyst_ratings")
sdf = spark.createDataFrame(df_ratings)
sdf.write.mode("overwrite").saveAsTable(f"{FULL}.analyst_ratings")
print("✓ analyst_ratings written")

# COMMAND ----------
# MAGIC %md
# MAGIC ## 5. `earnings_estimates` — Forward consensus (~1,400+ rows)

# COMMAND ----------

ESTIMATE_PERIODS = [
    ("Q1 2026", "quarter"), ("Q2 2026", "quarter"),
    ("FY 2025", "annual"), ("FY 2026", "annual"),
]

# Monthly snapshots over 12 months
SNAPSHOT_DATES = [date(2025, m, 15) for m in range(3, 13)] + [
    date(2026, 1, 15), date(2026, 2, 15),
]

estimate_rows = []
for ticker in SEED_PRICES:
    seed = FINANCIAL_SEEDS.get(ticker)
    if not seed:
        continue
    base_rev, qoq_g, gm, om, nm = seed
    co = next((c for c in COMPANIES if c[0] == ticker), None)
    shares_mm = co[5] if co else 1000

    for period, etype in ESTIMATE_PERIODS:
        # Base EPS for the period
        if etype == "annual":
            base_eps = round((base_rev * (1 + qoq_g * 8) * nm * 4) / shares_mm, 2)
            base_rev_est = round(base_rev * (1 + qoq_g * 8) * 4, 1)
        else:
            base_eps = round((base_rev * (1 + qoq_g * 8) * nm) / shares_mm, 2)
            base_rev_est = round(base_rev * (1 + qoq_g * 8), 1)

        # Revision drift over snapshots
        drift = np.random.choice([-1, 0, 1], p=[0.25, 0.45, 0.30])

        for sdate in SNAPSHOT_DATES:
            eps_noise = np.random.normal(drift * 0.003, 0.005)
            eps_cons = round(base_eps * (1 + eps_noise), 2)
            eps_high = round(eps_cons * np.random.uniform(1.05, 1.20), 2)
            eps_low = round(eps_cons * np.random.uniform(0.80, 0.95), 2)
            rev_cons = round(base_rev_est * (1 + eps_noise), 1)

            n_analysts = random.randint(15, 35)
            up_revs = random.randint(0, min(10, n_analysts))
            down_revs = random.randint(0, min(8, n_analysts - up_revs))

            rev_30d = round(drift * np.random.uniform(0.5, 2.0), 2)
            rev_90d = round(drift * np.random.uniform(1.0, 4.0), 2)

            if drift > 0:
                momentum = "positive"
            elif drift < 0:
                momentum = "negative"
            else:
                momentum = "stable"

            estimate_rows.append({
                "ticker": ticker,
                "estimate_period": period,
                "estimate_type": etype,
                "snapshot_date": sdate,
                "eps_consensus": eps_cons,
                "eps_high": eps_high,
                "eps_low": eps_low,
                "eps_revision_30d_pct": rev_30d,
                "eps_revision_90d_pct": rev_90d,
                "revenue_consensus_millions": rev_cons,
                "num_analysts": n_analysts,
                "num_upward_revisions_30d": up_revs,
                "num_downward_revisions_30d": down_revs,
                "revision_momentum": momentum,
            })

            base_eps *= (1 + eps_noise * 0.3)  # small cumulative drift

df_estimates = pd.DataFrame(estimate_rows)
print(f"earnings_estimates: {len(df_estimates)} rows")

# COMMAND ----------

spark.sql(f"DROP TABLE IF EXISTS {FULL}.earnings_estimates")
sdf = spark.createDataFrame(df_estimates)
sdf.write.mode("overwrite").saveAsTable(f"{FULL}.earnings_estimates")
print("✓ earnings_estimates written")

# COMMAND ----------
# MAGIC %md
# MAGIC ## 6. `valuation_metrics` — Weekly multiples (30 companies x ~104 weeks = ~3,120 rows)

# COMMAND ----------

# Generate Fridays in range
fridays = []
d = START_DATE
while d <= END_DATE:
    if d.weekday() == 4:  # Friday
        fridays.append(d)
    d += timedelta(days=1)

# Build price lookup by date for each ticker
price_by_date = {}
for _, row in df_prices.iterrows():
    price_by_date[(row["ticker"], row["trade_date"])] = row["close_price"]

val_rows = []
for ticker in SEED_PRICES:
    seed = FINANCIAL_SEEDS.get(ticker)
    if not seed:
        continue
    base_rev, qoq_g, gm, om, nm = seed
    co = next((c for c in COMPANIES if c[0] == ticker), None)
    shares_mm = co[5] if co else 1000
    mcap_b = co[4] if co else 100

    # TTM EPS proxy
    ttm_eps = round((base_rev * nm * 4) / shares_mm, 2)
    fwd_eps = round(ttm_eps * (1 + qoq_g * 4), 2)

    jan_price = SEED_PRICES[ticker]

    for fri in fridays:
        # Find closest trading day price
        close = None
        for offset in range(0, 5):
            test_date = fri - timedelta(days=offset)
            if (ticker, test_date) in price_by_date:
                close = price_by_date[(ticker, test_date)]
                break
        if close is None:
            close = SEED_PRICES[ticker]

        # Evolve EPS slowly
        weeks_elapsed = (fri - START_DATE).days / 7
        ttm_eps_now = ttm_eps * (1 + qoq_g * weeks_elapsed / 13)
        fwd_eps_now = fwd_eps * (1 + qoq_g * weeks_elapsed / 13)

        pe_ttm = round(close / ttm_eps_now, 2) if ttm_eps_now > 0 else None
        pe_fwd = round(close / fwd_eps_now, 2) if fwd_eps_now > 0 else None

        # EV/EBITDA: derive from price-based market cap proxy
        mcap_now = round(close * shares_mm / 1000, 2)  # in billions
        ev_now = round(mcap_now * np.random.uniform(1.0, 1.15), 2)
        ebitda_est = round(base_rev * 4 * (om + 0.05) * (1 + qoq_g * weeks_elapsed / 13) / 1000, 2)
        ev_ebitda = round(ev_now / ebitda_est, 2) if ebitda_est > 0 else None

        rev_ttm = round(base_rev * 4 * (1 + qoq_g * weeks_elapsed / 13) / 1000, 2)
        ev_rev = round(ev_now / rev_ttm, 2) if rev_ttm > 0 else None

        pb = round(np.random.uniform(2, 15) if ticker in ("AAPL", "MSFT", "NVDA", "META") else np.random.uniform(1, 6), 2)
        pfcf = round(close / max(fwd_eps_now * np.random.uniform(0.8, 1.5), 0.01), 2)

        # YTD return
        ytd_start_price = SEED_PRICES[ticker]
        if fri.year == 2025:
            # Find Jan 2 2025 price
            for td in trading_dates:
                if td >= date(2025, 1, 2) and (ticker, td) in price_by_date:
                    ytd_start_price = price_by_date[(ticker, td)]
                    break
        elif fri.year == 2026:
            for td in trading_dates:
                if td >= date(2026, 1, 2) and (ticker, td) in price_by_date:
                    ytd_start_price = price_by_date[(ticker, td)]
                    break
        ytd_ret = round(((close - ytd_start_price) / ytd_start_price) * 100, 2)

        # 1-year return
        one_yr_ago = fri - timedelta(days=365)
        yr_start = close  # fallback
        for td in trading_dates:
            if td >= one_yr_ago and (ticker, td) in price_by_date:
                yr_start = price_by_date[(ticker, td)]
                break
        ret_1y = round(((close - yr_start) / yr_start) * 100, 2)

        val_rows.append({
            "ticker": ticker,
            "as_of_date": fri,
            "close_price": round(close, 2),
            "pe_ratio_ttm": pe_ttm,
            "pe_ratio_forward": pe_fwd,
            "ev_to_ebitda": ev_ebitda,
            "ev_to_revenue": ev_rev,
            "price_to_book": pb,
            "price_to_fcf": pfcf,
            "total_return_ytd_pct": ytd_ret,
            "total_return_1y_pct": ret_1y,
            "market_cap_billions": mcap_now,
            "enterprise_value_billions": ev_now,
        })

df_valuation = pd.DataFrame(val_rows)
print(f"valuation_metrics: {len(df_valuation)} rows")

# COMMAND ----------

spark.sql(f"DROP TABLE IF EXISTS {FULL}.valuation_metrics")
sdf = spark.createDataFrame(df_valuation)
sdf.write.mode("overwrite").saveAsTable(f"{FULL}.valuation_metrics")
print("✓ valuation_metrics written")

# COMMAND ----------
# MAGIC %md
# MAGIC ## 7. `news_sentiment_daily` — Daily sentiment per company (~12K rows)

# COMMAND ----------

SOURCES = ["Reuters", "Bloomberg", "CNBC", "WSJ", "Financial Times",
           "MarketWatch", "Barron's", "Yahoo Finance", "Seeking Alpha", "The Verge"]

HEADLINE_TEMPLATES = {
    "bullish": [
        "{company} beats Q{q} estimates, shares surge {pct}%",
        "{company} announces major AI partnership, boosting growth outlook",
        "{company} raises full-year guidance on strong demand",
        "Analysts upgrade {ticker} citing robust fundamentals",
        "{company} reports record revenue in {sector} segment",
        "{ticker} stock jumps after blockbuster product launch",
        "{company} expands margins as cost-cutting pays off",
        "Institutional investors increase positions in {ticker}",
    ],
    "bearish": [
        "{company} misses revenue estimates, stock drops {pct}%",
        "{ticker} faces regulatory scrutiny, potential fine looms",
        "{company} cuts guidance amid macro headwinds",
        "Analysts downgrade {ticker} on slowing growth concerns",
        "{company} reports unexpected loss in key division",
        "{ticker} shares tumble on weaker-than-expected outlook",
        "{company} faces competitive pressure in core market",
        "Supply chain issues weigh on {company} earnings",
    ],
    "neutral": [
        "{company} reports in-line results for Q{q}",
        "{ticker} holds steady as market digests mixed signals",
        "{company} maintains outlook amid sector uncertainty",
        "Analysts mixed on {ticker} following restructuring announcement",
        "{company} announces leadership changes, markets await clarity",
    ],
}

# Build sector lookup
ticker_to_sector = {c[0]: c[2] for c in COMPANIES}
ticker_to_company = {c[0]: c[1] for c in COMPANIES}

# Price return lookup for correlation
price_returns = {}
for _, row in df_prices.iterrows():
    price_returns[(row["ticker"], row["trade_date"])] = row["daily_return_pct"]

news_rows = []
for ticker in SEED_PRICES:
    company = ticker_to_company.get(ticker, ticker)
    sector = ticker_to_sector.get(ticker, "Technology")

    for td in trading_dates:
        # Base sentiment correlated with price return
        daily_ret = price_returns.get((ticker, td), 0)

        # Sentiment score: 0.5 base + correlation to daily return + noise
        base_sent = 0.5 + daily_ret * 0.03 + np.random.normal(0, 0.08)
        base_sent = max(0.05, min(0.95, base_sent))

        if base_sent > 0.6:
            label = "bullish"
        elif base_sent < 0.4:
            label = "bearish"
        else:
            label = "neutral"

        total_articles = random.randint(2, 15)
        if label == "bullish":
            bullish_ct = random.randint(int(total_articles * 0.5), total_articles)
            bearish_ct = random.randint(0, total_articles - bullish_ct)
        elif label == "bearish":
            bearish_ct = random.randint(int(total_articles * 0.5), total_articles)
            bullish_ct = random.randint(0, total_articles - bearish_ct)
        else:
            bullish_ct = random.randint(1, max(2, total_articles // 3))
            bearish_ct = random.randint(1, max(2, total_articles // 3))
        neutral_ct = total_articles - bullish_ct - bearish_ct
        neutral_ct = max(0, neutral_ct)

        confidence = round(50 + abs(base_sent - 0.5) * 80 + np.random.normal(0, 5), 1)
        confidence = max(30, min(99, confidence))

        impact = round(abs(base_sent - 0.5) * 2 * (confidence / 100), 3)

        # Generate a headline
        templates = HEADLINE_TEMPLATES[label]
        tmpl = random.choice(templates)
        headline = tmpl.format(
            company=company.split(" Inc")[0].split(" Corp")[0],
            ticker=ticker,
            sector=sector,
            q=random.randint(1, 4),
            pct=round(abs(daily_ret) + random.uniform(1, 5), 1),
        )

        news_rows.append({
            "ticker": ticker,
            "news_date": td,
            "sector": sector,
            "avg_sentiment_score": round(base_sent, 4),
            "sentiment_label": label,
            "total_articles": total_articles,
            "bullish_article_count": bullish_ct,
            "bearish_article_count": bearish_ct,
            "neutral_article_count": neutral_ct,
            "avg_confidence_pct": confidence,
            "max_impact_score": impact,
            "top_headline": headline,
            "top_headline_source": random.choice(SOURCES),
            "sentiment_7d_moving_avg": None,   # computed below
            "sentiment_30d_moving_avg": None,   # computed below
        })

# Compute rolling averages per ticker
df_news = pd.DataFrame(news_rows)
df_news = df_news.sort_values(["ticker", "news_date"])
df_news["sentiment_7d_moving_avg"] = (
    df_news.groupby("ticker")["avg_sentiment_score"]
    .transform(lambda x: x.rolling(7, min_periods=1).mean())
    .round(4)
)
df_news["sentiment_30d_moving_avg"] = (
    df_news.groupby("ticker")["avg_sentiment_score"]
    .transform(lambda x: x.rolling(30, min_periods=1).mean())
    .round(4)
)
print(f"news_sentiment_daily: {len(df_news)} rows")

# COMMAND ----------

spark.sql(f"DROP TABLE IF EXISTS {FULL}.news_sentiment_daily")
sdf = spark.createDataFrame(df_news)
sdf.write.mode("overwrite").saveAsTable(f"{FULL}.news_sentiment_daily")
print("✓ news_sentiment_daily written")

# COMMAND ----------
# MAGIC %md
# MAGIC ## 8. `institutional_holdings` — 13F positions (~2,400 rows)

# COMMAND ----------

INSTITUTIONS = [
    ("Vanguard Group", "mutual_fund"),
    ("BlackRock", "etf"),
    ("State Street Global Advisors", "etf"),
    ("Fidelity Management", "mutual_fund"),
    ("Capital Research", "mutual_fund"),
    ("T. Rowe Price", "mutual_fund"),
    ("Geode Capital", "advisory"),
    ("Norges Bank", "pension"),
    ("Wellington Management", "advisory"),
    ("Berkshire Hathaway", "advisory"),
    ("JPMorgan Asset Management", "mutual_fund"),
    ("Goldman Sachs Asset Management", "advisory"),
    ("Morgan Stanley Investment Management", "advisory"),
    ("Citadel Advisors", "hedge_fund"),
    ("Renaissance Technologies", "hedge_fund"),
    ("Bridgewater Associates", "hedge_fund"),
    ("AQR Capital", "hedge_fund"),
    ("Two Sigma", "hedge_fund"),
    ("Xponance", "advisory"),
    ("D.E. Shaw", "hedge_fund"),
]

HOLDING_QUARTERS = [
    date(2024, 3, 31), date(2024, 6, 30),
    date(2024, 9, 30), date(2024, 12, 31),
]

hold_rows = []
for ticker in SEED_PRICES:
    co = next((c for c in COMPANIES if c[0] == ticker), None)
    shares_total_mm = co[5] if co else 1000
    mcap = co[4] if co else 100

    # 15-20 holders per stock
    holders = random.sample(INSTITUTIONS, random.randint(15, 20))

    for inst_name, inst_type in holders:
        # Base position: larger institutions hold more
        if inst_name in ("Vanguard Group", "BlackRock", "State Street Global Advisors"):
            base_shares = int(shares_total_mm * np.random.uniform(0.05, 0.09) * 1_000_000)
        elif inst_type == "hedge_fund":
            base_shares = int(shares_total_mm * np.random.uniform(0.001, 0.01) * 1_000_000)
        else:
            base_shares = int(shares_total_mm * np.random.uniform(0.01, 0.04) * 1_000_000)

        prev_shares = None
        for qd in HOLDING_QUARTERS:
            # Quarterly change
            change_type = np.random.choice(
                ["increased", "decreased", "unchanged", "new", "sold_out"],
                p=[0.35, 0.25, 0.25, 0.1, 0.05]
            )

            if prev_shares is None:
                change_type = "new"

            if change_type == "new":
                shares = base_shares
                change = shares
            elif change_type == "sold_out":
                shares = 0
                change = -prev_shares if prev_shares else 0
            elif change_type == "increased":
                delta = int(base_shares * np.random.uniform(0.02, 0.15))
                shares = (prev_shares or base_shares) + delta
                change = delta
            elif change_type == "decreased":
                delta = int(base_shares * np.random.uniform(0.02, 0.15))
                shares = max(0, (prev_shares or base_shares) - delta)
                change = -delta
            else:  # unchanged
                shares = prev_shares or base_shares
                change = 0

            # Value based on quarter-end price (approx)
            approx_price = SEED_PRICES[ticker] * (1 + ANNUAL_DRIFT[ticker] *
                            ((qd - START_DATE).days / 365))
            pos_value_mm = round(shares * approx_price / 1_000_000, 2)

            # Portfolio weight (fake but plausible)
            if inst_type in ("mutual_fund", "etf"):
                port_wt = round(np.random.uniform(0.5, 5.0), 2)
            else:
                port_wt = round(np.random.uniform(0.1, 3.0), 2)

            change_pct = round((change / prev_shares) * 100, 2) if prev_shares and prev_shares > 0 else (100.0 if change_type == "new" else 0.0)

            if shares > 0 or change_type == "sold_out":
                hold_rows.append({
                    "ticker": ticker,
                    "institution_name": inst_name,
                    "institution_type": inst_type,
                    "quarter_end_date": qd,
                    "shares_held": shares,
                    "position_value_millions": pos_value_mm,
                    "portfolio_weight_pct": port_wt,
                    "shares_change": change,
                    "shares_change_pct": change_pct,
                    "position_change_type": change_type,
                })

            prev_shares = shares if shares > 0 else None

df_holdings = pd.DataFrame(hold_rows)
print(f"institutional_holdings: {len(df_holdings)} rows")

# COMMAND ----------

spark.sql(f"DROP TABLE IF EXISTS {FULL}.institutional_holdings")
sdf = spark.createDataFrame(df_holdings)
sdf.write.mode("overwrite").saveAsTable(f"{FULL}.institutional_holdings")
print("✓ institutional_holdings written")

# COMMAND ----------
# MAGIC %md
# MAGIC ## 9. `sector_performance` — Weekly aggregates (6 sectors x ~104 weeks = ~624 rows)

# COMMAND ----------

SECTOR_LIST = ["Technology", "Healthcare", "Energy", "Financials", "Consumer", "Industrials"]
sector_tickers = defaultdict(list)
for c in COMPANIES:
    sector_tickers[c[2]].append(c[0])

sector_rows = []
for fri in fridays:
    for sector in SECTOR_LIST:
        tickers = sector_tickers[sector]

        # Compute weekly return for each ticker
        week_start = fri - timedelta(days=4)
        returns = []
        for t in tickers:
            p_end = price_by_date.get((t, fri))
            p_start = None
            for offset in range(0, 7):
                d = week_start - timedelta(days=offset)
                if (t, d) in price_by_date:
                    p_start = price_by_date[(t, d)]
                    break
            if p_end and p_start and p_start > 0:
                returns.append(((p_end - p_start) / p_start) * 100)

        wk_ret = round(np.mean(returns), 2) if returns else 0.0

        # YTD return for sector
        ytd_returns = []
        for t in tickers:
            p_now = price_by_date.get((t, fri))
            # Find start of year price
            yr_start_date = date(fri.year, 1, 2)
            p_ytd = None
            for offset in range(0, 10):
                d = yr_start_date + timedelta(days=offset)
                if (t, d) in price_by_date:
                    p_ytd = price_by_date[(t, d)]
                    break
            if not p_ytd:
                p_ytd = SEED_PRICES.get(t, 100)
            if p_now and p_ytd > 0:
                ytd_returns.append(((p_now - p_ytd) / p_ytd) * 100)

        ytd_ret = round(np.mean(ytd_returns), 2) if ytd_returns else 0.0

        # Sentiment from news
        week_news = df_news[
            (df_news.sector == sector) &
            (df_news.news_date >= week_start) &
            (df_news.news_date <= fri)
        ]
        avg_sent = round(week_news.avg_sentiment_score.mean(), 4) if len(week_news) > 0 else 0.5
        total_articles = int(week_news.total_articles.sum()) if len(week_news) > 0 else 0

        if avg_sent > 0.55:
            sent_label = "bullish"
        elif avg_sent < 0.45:
            sent_label = "bearish"
        else:
            sent_label = "neutral"

        # Avg PE from valuation
        sector_val = df_valuation[
            (df_valuation.ticker.isin(tickers)) &
            (df_valuation.as_of_date == fri)
        ]
        avg_pe = round(sector_val.pe_ratio_forward.mean(), 2) if len(sector_val) > 0 else None

        pct_positive = round(sum(1 for r in returns if r > 0) / max(len(returns), 1) * 100, 1)

        # Best and worst
        if returns:
            ret_dict = dict(zip(tickers[:len(returns)], returns))
            best = max(ret_dict, key=ret_dict.get)
            worst = min(ret_dict, key=ret_dict.get)
        else:
            best = tickers[0]
            worst = tickers[-1]

        sector_rows.append({
            "sector": sector,
            "week_ending_date": fri,
            "sector_return_1w_pct": wk_ret,
            "sector_return_ytd_pct": ytd_ret,
            "avg_sentiment_score": avg_sent,
            "sentiment_label": sent_label,
            "total_news_articles": total_articles,
            "avg_pe_ratio": avg_pe,
            "pct_stocks_positive_1w": pct_positive,
            "best_performing_ticker": best,
            "worst_performing_ticker": worst,
        })

df_sector = pd.DataFrame(sector_rows)
print(f"sector_performance: {len(df_sector)} rows")

# COMMAND ----------

spark.sql(f"DROP TABLE IF EXISTS {FULL}.sector_performance")
sdf = spark.createDataFrame(df_sector)
sdf.write.mode("overwrite").saveAsTable(f"{FULL}.sector_performance")
print("✓ sector_performance written")

# COMMAND ----------
# MAGIC %md
# MAGIC ## Verification — Row counts and sample queries

# COMMAND ----------

tables = [
    "company_profile", "stock_price_daily", "quarterly_financials",
    "analyst_ratings", "earnings_estimates", "valuation_metrics",
    "news_sentiment_daily", "institutional_holdings", "sector_performance",
]

total = 0
for t in tables:
    count = spark.sql(f"SELECT COUNT(*) as cnt FROM {FULL}.{t}").collect()[0]["cnt"]
    total += count
    print(f"  {t}: {count:,} rows")

print(f"\n  TOTAL: {total:,} rows")

# COMMAND ----------

# Sample: NVDA revenue growth
display(spark.sql(f"""
  SELECT fiscal_quarter, revenue_millions, revenue_yoy_growth_pct,
         eps_actual, eps_beat_miss_pct, guidance_direction
  FROM {FULL}.quarterly_financials
  WHERE ticker = 'NVDA'
  ORDER BY fiscal_quarter
"""))

# COMMAND ----------

# Sample: Sector performance latest week
display(spark.sql(f"""
  SELECT sector, sector_return_1w_pct, sector_return_ytd_pct,
         avg_sentiment_score, best_performing_ticker
  FROM {FULL}.sector_performance
  WHERE week_ending_date = (SELECT MAX(week_ending_date) FROM {FULL}.sector_performance)
  ORDER BY sector_return_1w_pct DESC
"""))

# COMMAND ----------

# Sample: Xponance holdings
display(spark.sql(f"""
  SELECT ticker, shares_held, position_value_millions,
         shares_change_pct, position_change_type
  FROM {FULL}.institutional_holdings
  WHERE institution_name = 'Xponance'
    AND quarter_end_date = '2024-12-31'
  ORDER BY position_value_millions DESC
"""))

# COMMAND ----------

# Sample: Top stocks by bullish sentiment (last 7 days)
display(spark.sql(f"""
  SELECT ticker, sector,
         ROUND(AVG(avg_sentiment_score), 3) as avg_sentiment,
         SUM(total_articles) as total_articles,
         SUM(bullish_article_count) as bullish_count
  FROM {FULL}.news_sentiment_daily
  WHERE news_date >= DATE_SUB(
    (SELECT MAX(news_date) FROM {FULL}.news_sentiment_daily), 7)
  GROUP BY ticker, sector
  ORDER BY avg_sentiment DESC
  LIMIT 10
"""))
