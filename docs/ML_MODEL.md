# Sales Prediction Module

## Model

The forecast uses Scikit-learn `LinearRegression`.

## Training Data

Historical monthly revenue is generated from MySQL:

```text
month_index -> monthly_revenue
0           -> revenue for first month
1           -> revenue for second month
```

## Features Used

- `month_index`: sequential numeric representation of month.

## Output

The service predicts the next 3-6 months and returns actual, fitted, and forecast values so the frontend can plot predicted vs actual revenue.

It also returns an explanation:

```text
Sales are predicted to rise because the historical monthly revenue trend is upward.
```

Feature importance is intentionally simple for interview clarity: the absolute Linear Regression coefficient tells how much monthly revenue changes when `month_index` increases by one.

## Assumptions

- Recent history is directionally useful.
- Revenue trend is approximately linear across the training window.
- No major unseen business shock changes the future pattern.

## Limitations

- Does not capture holidays, discounts, stockouts, campaigns, price changes, or marketplace policy changes.
- Linear Regression is intentionally simple and explainable for internship-level review. A production forecasting roadmap could add ARIMA, Prophet, XGBoost, or hierarchical category-level forecasts.
