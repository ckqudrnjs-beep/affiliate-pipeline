from pipeline import youtube


def test_snippet_tags_are_list_of_strings():
    assert isinstance(youtube.TAGS, list)
    assert all(isinstance(t, str) for t in youtube.TAGS)


def test_hashtags_line():
    assert youtube.tags({"format": "quiz"}).endswith("#Shorts")
