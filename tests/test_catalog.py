from neighborhood_intelligence.catalog import METRICS


def test_metric_catalog_has_unique_ids_and_variables() -> None:
    assert len({metric.metric_id for metric in METRICS}) == len(METRICS)
    assert len({metric.variable for metric in METRICS}) == len(METRICS)
