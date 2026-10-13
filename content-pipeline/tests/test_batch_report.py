"""Offline artifact metrics; inclusive ties match the founder's round-3 audit."""
from shared.batch_report import option_length_report, format_option_length_report


def entry(counts,key="A",**extra):
    return {"key":key,"options":[{"label":label,"text":" ".join([label]*count)} for label,count in zip("ABCD",counts)],**extra}


def test_inclusive_longest_and_unique_are_not_conflated():
    report=option_length_report([entry([20,20,18,19]),entry([20,19,18,17]),entry([19,20,18,17])])
    assert report["key_is_longest_count"]==2 and report["key_is_uniquely_longest_count"]==1
    assert report["key_is_longest_rate"]==2/3
    assert "ties included" in format_option_length_report(report)
    assert not report["target_met"]


def test_report_uses_key_label_not_option_position_and_tracks_stages():
    candidates=[entry([17,18,22,20],key="C",accepted=True),entry([17,22,18,20],awaiting_external_judge=True),{"key":"A","options":[]}]
    report=option_length_report(candidates)
    assert report["count"]==2 and report["excluded"]==1
    assert report["accepted"]["key_is_longest_rate"]==1
    assert report["awaiting_external_judge"]["key_is_longest_rate"]==0


def test_exact_35_percent_target_and_warning_boundary():
    low=[entry([20,19,18,17])]*7+[entry([19,20,18,17])]*13
    assert option_length_report(low)["target_met"] is True
    high=[entry([20,19,18,17])]*8+[entry([19,20,18,17])]*12
    report=option_length_report(high)
    assert report["key_is_longest_rate"]==.4 and not report["target_met"]
    assert "WARNING target exceeded" in format_option_length_report(report)


def test_no_complete_options_is_not_a_fake_zero_rate_pass():
    report=option_length_report([{"key":"A","options":[]}])
    assert report["count"]==0 and report["excluded"]==1
    assert report["key_is_longest_rate"] is None and report["target_met"] is None
