# Data Pipeline

## Load

The importer reads the Amazon Sale Report CSV and writes into MySQL. The analytics service then reads from MySQL directly. This keeps the dashboard connected to the database, not to a CSV file.

## Clean

Rows are removed when they have:

- Missing order id, SKU, category, date, or amount
- Invalid dates
- Quantity less than or equal to zero
- Amount less than or equal to zero
- Cancelled order status

## Feature Engineering

- `price = amount / quantity` during import because the Amazon report provides order amount.
- `revenue = quantity * price` in analytics.
- `month = YYYY-MM` for monthly aggregation.

## Store

Base normalized records are stored in MySQL. Processed analytics are computed on demand so filters always use current data. For larger data volumes, add materialized monthly summary tables or scheduled ETL jobs.
