# 📊 Macro Signals Dashboard --- Product Requirements Document (PRD)

## Version: MVP (Weekend Build)

## Owner: Jeff

## Goal: Visual macro decision system for capital allocation

------------------------------------------------------------------------

# 🧠 1. Overview

## What we are building

The **Macro Signals Dashboard** is a web-based application that
translates complex global macroeconomic conditions into:

-   Simple visual signals
-   Clear investment guidance
-   Trend-aware decision support

The system is designed to answer one core question:

> **"Should I be deploying capital right now, or waiting?"**

------------------------------------------------------------------------

## Why this exists

Modern markets are driven by macro forces: - Interest rates -
Inflation - Liquidity - Geopolitics

However: - Raw data is noisy - News is overwhelming - Signals are hard
to interpret in real-time

This product solves that by:

> **Synthesizing macro inputs into structured, visual, actionable
> outputs**

------------------------------------------------------------------------

## Key insight

Markets don't turn on headlines---they turn on **directional changes in
macro conditions**.

Therefore, the system emphasizes:

-   **Trend over point-in-time**
-   **Direction over precision**
-   **Decision-making over analysis**

------------------------------------------------------------------------

# 🎯 2. Objectives

## Primary Objective

Enable a user to determine in **\<10 seconds**:

1.  What macro regime we are in
2.  Whether conditions are improving or worsening
3.  Whether to:
    -   Deploy capital
    -   Hold cash
    -   Shift to defensive assets

------------------------------------------------------------------------

## Secondary Objectives

-   Track macro conditions over time (trend detection)
-   Provide context via headlines and drivers
-   Reduce emotional decision-making
-   Create a repeatable, systematic investment framework

------------------------------------------------------------------------

# 👤 3. Target User

-   Individual investor
-   Macro-aware but not a professional economist
-   Medium to long-term horizon
-   Interested in:
    -   Equities
    -   Bitcoin
    -   Gold
    -   Bonds / cash

------------------------------------------------------------------------

# 🧱 4. Core Product Concept

## "Simple Output, Serious Inputs"

The system uses multiple macro signals under the hood, but exposes only:

-   Clean visual states
-   Directional trends
-   Actionable guidance

------------------------------------------------------------------------

# 📊 5. Macro Framework

## Signals Tracked (MVP)

The system evaluates 5 core macro dimensions:

### 1. Real Yields (Interest Rate Pressure)

-   Proxy: 10Y Treasury yield behavior
-   Rising → tighter conditions
-   Falling → easing conditions

### 2. Federal Reserve Expectations

-   Hawkish → restrictive
-   Dovish → supportive

### 3. Inflation / Oil Shock

-   Rising oil → inflation pressure
-   Falling oil → easing

### 4. Dollar Strength (DXY)

-   Strong → tighter liquidity
-   Weak → easing

### 5. Credit Stress / Growth Risk

-   Rising stress → risk-off
-   Low stress → stable

------------------------------------------------------------------------

# 🔢 6. Scoring System

Each signal: -2 to +2

Macro Score = sum(signals) → normalized 0--100

------------------------------------------------------------------------

# 🔄 7. Trend Detection

Compare today vs 3-day average:

-   🟢 Improving
-   🟡 Stabilizing
-   🔴 Worsening

------------------------------------------------------------------------

# 🧭 8. Output System

## Market Environment

Favorable / Mixed / Unfavorable + trend

## Action Bias

Deploy / Hold / Bonds / De-risk signals

## Asset Signals

Equities, Bitcoin, Gold, Bonds

## Drivers

2--3 bullets

## Headlines

3--5 signals

## Change Triggers

Explicit macro shifts

## Confidence

Low / Medium / High

------------------------------------------------------------------------

# 🎨 9. UI / UX Requirements

## Layout

1.  Macro Status Card
2.  Action Panel
3.  Asset Grid
4.  Trend Chart
5.  Drivers & Headlines

------------------------------------------------------------------------

# 🗄️ 10. Data Model

macro_entries: - id - date - market_environment - macro_score -
trend_direction - action_bias - equities_score - bitcoin_score -
gold_score - bonds_score - confidence - drivers (json) - headlines
(json) - created_at

------------------------------------------------------------------------

# 🔄 11. Workflow

1.  Cron triggers API
2.  AI generates JSON
3.  Store in DB
4.  UI renders

------------------------------------------------------------------------

# 🤖 12. AI Requirements

-   Strict JSON
-   Deterministic
-   No hallucinated structure

------------------------------------------------------------------------

# ⚠️ 13. Risks

-   Overfitting
-   AI inconsistency
-   Visual clutter

------------------------------------------------------------------------

# 🚀 14. Future Enhancements

-   Real-time data
-   Alerts
-   Portfolio integration

------------------------------------------------------------------------

# 🎯 15. Success Criteria

User understands: - What's happening - If it's improving - What to do

------------------------------------------------------------------------

# 🧠 Final Principle

"We are not predicting the future.\
We are detecting when the present is changing."
