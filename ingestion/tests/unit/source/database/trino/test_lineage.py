#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Regression tests for Trino cross-database lineage."""

from unittest.mock import MagicMock, patch

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.api.models import Either
from metadata.ingestion.source.database.trino.lineage import TrinoLineageSource


class TrinoLineageSourceTestDouble(TrinoLineageSource):
    """Minimal Trino lineage source for unit testing."""

    def __init__(self, metadata):
        self.metadata = metadata
        self.config = MagicMock()
        self.config.serviceName = "repro_trino"
        self.source_config = MagicMock()
        self.source_config.crossDatabaseServiceNames = ["repro_postgres"]


def _mock_column(column_name):
    column = MagicMock()
    column.name.root = column_name
    return column


def test_yield_cross_database_lineage_finds_uppercase_source_table():
    """Trino cross-db lineage should resolve the uppercase Postgres source table."""
    metadata = MagicMock()

    trino_database = MagicMock()
    trino_database.fullyQualifiedName.root = "repro_trino.postgres"

    source_database = MagicMock()
    source_database.fullyQualifiedName.root = "repro_postgres.source_db"

    trino_table = MagicMock()
    trino_table.id.root = "11111111-1111-1111-1111-111111111111"
    trino_table.fullyQualifiedName.root = "repro_trino.postgres.source_schema.customer"
    trino_table.name.root = "customer"
    trino_table.columns = []

    source_table = MagicMock()
    source_table.id.root = "22222222-2222-2222-2222-222222222222"
    source_table.fullyQualifiedName.root = "repro_postgres.source_db.source_schema.CUSTOMER"
    source_table.name.root = "CUSTOMER"
    source_table.columns = [_mock_column("id"), _mock_column("name")]

    def list_all_entities_side_effect(entity, params=None, **_kwargs):
        if entity is Database and params == {"service": "repro_trino"}:
            return [trino_database]
        if entity is Database and params == {"service": "repro_postgres"}:
            return [source_database]
        if entity is Table and params == {"database": "repro_trino.postgres"}:
            return [trino_table]
        if entity is Table and params == {"database": "repro_postgres.source_db"}:
            return [source_table]
        return []

    metadata.list_all_entities.side_effect = list_all_entities_side_effect
    metadata.get_by_name.return_value = None

    lineage_source = TrinoLineageSourceTestDouble(metadata)

    with patch.object(
        TrinoLineageSource,
        "get_cross_database_lineage",
        return_value=Either(right="cross-database-edge"),
    ) as mock_get_cross_database_lineage:
        result = list(lineage_source.yield_cross_database_lineage())

    assert len(result) == 1
    assert result[0].right == "cross-database-edge"
    mock_get_cross_database_lineage.assert_called_once_with(source_table, trino_table)