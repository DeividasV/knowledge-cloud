#!/usr/bin/env python3
"""Analyze a YouTube channel's uploads playlist duration distribution.

Usage:
    export YOUTUBE_API_KEY=...
    python3 scripts/analyze-channel.py <channel-id-or-uploads-playlist-id>

Example:
    python3 scripts/analyze-channel.py UCNYejKoEJ84iGgXPwTBkCCg
    python3 scripts/analyze-channel.py UUNYejKoEJ84iGgXPwTBkCCg
"""
import argparse
import json
import os
import sys
import urllib.parse
import urllib.request

API_KEY = os.environ.get("YOUTUBE_API_KEY", "")
if not API_KEY:
    print("Set YOUTUBE_API_KEY", file=sys.stderr)
    raise SystemExit(1)

BASE = "https://www.googleapis.com/youtube/v3"


def resolve_uploads_playlist_id(identifier: str) -> str:
    """Convert a channel ID to its uploads playlist ID if needed."""
    if identifier.startswith("UU") and len(identifier) == 24:
        return identifier
    if identifier.startswith("UC") and len(identifier) == 24:
        return "UU" + identifier[2:]
    return identifier


def iso_duration_to_seconds(d: str) -> int:
    """Parse PT#H#M#S into seconds."""
    if not d:
        return 0
    d = d.replace("PT", "")
    seconds = 0
    for part, multiplier in [("H", 3600), ("M", 60), ("S", 1)]:
        if part in d:
            value, d = d.split(part, 1)
            seconds += int(value) * multiplier
    return seconds


def fetch_json(url: str):
    with urllib.request.urlopen(url) as res:
        return json.loads(res.read().decode())


def fetch_playlist_items(playlist_id: str):
    items = []
    page_token = None
    while True:
        params = {
            "part": "snippet",
            "playlistId": playlist_id,
            "maxResults": "50",
            "key": API_KEY,
        }
        if page_token:
            params["pageToken"] = page_token
        url = f"{BASE}/playlistItems?{urllib.parse.urlencode(params)}"
        data = fetch_json(url)
        items.extend(data.get("items", []))
        page_token = data.get("nextPageToken")
        if not page_token:
            break
    return items


def fetch_video_details(video_ids: list[str]):
    all_items = []
    for i in range(0, len(video_ids), 50):
        batch = video_ids[i : i + 50]
        params = {
            "part": "snippet,contentDetails,statistics",
            "id": ",".join(batch),
            "maxResults": "50",
            "key": API_KEY,
        }
        url = f"{BASE}/videos?{urllib.parse.urlencode(params)}"
        data = fetch_json(url)
        all_items.extend(data.get("items", []))
    return all_items


def main():
    parser = argparse.ArgumentParser(description="Analyze YouTube channel uploads duration distribution")
    parser.add_argument("identifier", help="Channel ID or uploads playlist ID")
    args = parser.parse_args()

    playlist_id = resolve_uploads_playlist_id(args.identifier)
    print(f"Analyzing playlist: {playlist_id}")
    print("Fetching playlist items...")
    playlist_items = fetch_playlist_items(playlist_id)
    print(f"Total playlist items: {len(playlist_items)}")

    video_ids = [
        item["snippet"]["resourceId"]["videoId"]
        for item in playlist_items
        if item.get("snippet", {}).get("resourceId", {}).get("videoId")
    ]
    print(f"Video IDs extracted: {len(video_ids)}")

    print("Fetching video details...")
    details = fetch_video_details(video_ids)
    print(f"Video details received: {len(details)}")

    durations = []
    missing = 0
    for item in details:
        duration_str = item.get("contentDetails", {}).get("duration", "")
        sec = iso_duration_to_seconds(duration_str)
        if sec <= 0:
            missing += 1
        durations.append(sec)

    buckets = [
        (0, 60, "0-1 min"),
        (61, 180, "1-3 min"),
        (181, 300, "3-5 min"),
        (301, 600, "5-10 min"),
        (601, 1200, "10-20 min"),
        (1201, 1800, "20-30 min"),
        (1801, 3600, "30-60 min"),
        (3601, 999999, "60+ min"),
    ]

    print("\nDuration distribution:")
    for lo, hi, label in buckets:
        count = sum(1 for d in durations if lo <= d <= hi)
        pct = count / len(durations) * 100 if durations else 0
        print(f"  {label:10s}: {count:4d} ({pct:5.1f}%)")

    over_300 = sum(1 for d in durations if d > 300)
    print(f"\nVideos longer than 5 min (current filter): {over_300}")
    print(f"Videos <= 5 min (filtered out): {len(durations) - over_300}")
    print(f"Missing/invalid duration: {missing}")

    # Simulate first N playlist items behavior
    print("\nFirst-N playlist behavior with current 500-item cap:")
    first_500_ids = video_ids[:500]
    first_500_details = [d for d in details if d["id"] in set(first_500_ids)]
    first_500_long = sum(
        1
        for d in first_500_details
        if iso_duration_to_seconds(d.get("contentDetails", {}).get("duration", "")) > 300
    )
    print(f"  First 500 items -> {first_500_long} videos > 5min")

    print("\nWith no duration filter, all playlist videos would be stored:")
    print(f"  Total: {len(details)}")


if __name__ == "__main__":
    main()
