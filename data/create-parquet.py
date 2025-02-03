import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
import numpy as np

# Set a random seed for reproducibility
np.random.seed(42)

# Generate a time series (timestamps) with 10 million data points
timestamps = pd.date_range(start="2024-02-01", periods=10000000, freq="ms")

# Generate 4 random walk traces
random_walk_1 = np.cumsum(np.random.normal(0, 1, 10000000))
random_walk_2 = np.cumsum(np.random.normal(0, 1, 10000000))
random_walk_3 = np.cumsum(np.random.normal(0, 1, 10000000))
random_walk_4 = np.cumsum(np.random.normal(0, 1, 10000000))

# Create a DataFrame
df = pd.DataFrame({
    "timestamp": timestamps,  # Leave the timestamp as a datetime object
    "value_1": random_walk_1,
    "value_2": random_walk_2,
    "value_3": random_walk_3,
    "value_4": random_walk_4
})

# Convert DataFrame to a PyArrow Table, with 'timestamp' as a native TIMESTAMP
table = pa.Table.from_pandas(df, preserve_index=False)

# Write the original DataFrame to a Parquet file
pq.write_table(table, "test_data.parquet")
print("Parquet file with 10 million random trace points (4 values each) created successfully!")

# Aggregate the data to rougher buckets by resampling the time series
df_aggregated = df.set_index("timestamp").resample('10S').mean().reset_index()

# Convert the aggregated DataFrame to a PyArrow Table
table_aggregated = pa.Table.from_pandas(df_aggregated, preserve_index=False)

# Write the aggregated data to a new Parquet file
pq.write_table(table_aggregated, "test_data_aggregated.parquet")
print("Aggregated Parquet file with 10-second time buckets created successfully!")

# Check the schema of the original and aggregated Parquet files
parquet_file = pq.ParquetFile('test_data.parquet')
print(parquet_file.schema)

parquet_file_aggregated = pq.ParquetFile('test_data_aggregated.parquet')
print(parquet_file_aggregated.schema)
