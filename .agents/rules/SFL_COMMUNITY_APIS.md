# API Extraction Plan
- [x] Endpoint: List farms (`GET /community/farms`)
- [x] Endpoint: Get farms by id (legacy) (`POST /community/farms`)
- [x] Endpoint: Get a farm (`GET /community/farms/{id}`)
- [x] Endpoint: List auctions (`GET /community/data?type=auctions`)
- [x] Endpoint: Auction results (`GET /community/data?type=auctionResults`)
- [x] Endpoint: Marketplace activity (`GET /community/data?type=marketplaceActivity`)
- [x] Endpoint: Marketplace item (`GET /community/data?type=tradeable`)
- [x] Endpoint: Marketplace profile (`GET /community/data?type=marketplaceProfile`)
- [x] Endpoint: Ticket leaderboard (`GET /community/data?type=ticketLeaderboard`)
- [x] Endpoint: Discord announcements (`GET /community/data?type=discordAnnouncements`)
- [x] Endpoint: List raffles (`GET /community/data?type=raffles`)
- [x] Endpoint: Raffle results (`GET /community/data?type=raffleResults`)
- [x] Endpoint: Nightly farm dump (`GET /community/data?type=nightlyDump`)
- [x] Compile the final report in the scratchpad

## General API Information

### Base URLs
- **Mainnet:** `https://api.sunflower-land.com` (real player data)
- **Testnet:** `https://api-dev.sunflower-land.com` (Amoy, test data)

### Authentication
All requests under `/community` routes require an API key passed in the header:
- Header name: `x-api-key`
- Format: `sfl.YOUR.KEY`
- Requirements: Requires VIP access and a Bumpkin of level 50 or higher.
- Errors: `401 Unauthorized` if missing, invalid, or farm no longer meets requirements.

### Rate Limits
- Throttled per IP: Roughly **one request every 5 seconds** on `/community` routes.
- Throttles double to **10 seconds** if hammered.
- Returns `429 Too Many Requests` with an empty body on throttle.

### Sandbox & Key Management
- API Keys are retrieved via the documentation sandbox while logged into the game.
- Keys can be rotated, immediately invalidating the old one.
- Nightly dump CDN files do not require an API key to download (only the manifest endpoint requires it).

---

## 1. List farms (`GET /community/farms`)

### Description
Page through every farm in the game, cursor-based. Returns farms in pages, ordered by internal id. Each item carries the farm's account id, its NFT id (when one is linked) and the full farm object — the same game state a player sees when visiting.
Walk the whole set by passing the previous response's next_cursor back as the cursor query parameter. The last page has no next_cursor.
If you are after the whole dataset rather than a slice of it, don't page through this endpoint — download the Nightly farm dump instead. It is one gzipped file containing every farm and gives you a consistent snapshot; ask this API for the manifest, then pull the file itself off the CDN with no throttle. Reach for this endpoint when you need data fresher than last night, or only a handful of pages.

### Request
- **Method:** `GET`
- **URL:** `https://api.sunflower-land.com/community/farms`
- **Headers:**
  - `x-api-key`: `sfl.YOUR.KEY` (Required. A community API key requires VIP access and a Bumpkin of level 50 or higher.)
- **Query Parameters:**
  - `limit` (integer, optional): Maximum farms per page (1–1000, default 100). Around 500 is a practical ceiling.
  - `cursor` (string, optional): Opaque pagination cursor from the `next_cursor` field of the previous response. Omit for the first page.

### Response (200 OK)
```json
{
  "farms": [
    {
      "id": 121500,
      "nft_id": 29411,
      "farm": {
        "balance": "1250.421",
        "coins": 128350,
        "inventory": {
          "Basic Land": "9",
          "Sunflower Seed": "204",
          "Sunflower": "120",
          "Wood": "56.5",
          "Stone": "23",
          "Axe": "3",
          "Water Well": "1"
        },
        "wardrobe": {
          "Basic Hair": 1,
          "Red Farmer Shirt": 1,
          "Farmer Overalls": 1
        },
        "bumpkin": {
          "id": 5321,
          "experience": 105300,
          "equipped": {
            "hair": "Basic Hair",
            "shirt": "Red Farmer Shirt",
            "pants": "Farmer Overalls",
            "background": "Farm Background",
            "body": "Beige Farmer Potion",
            "shoes": "Black Farmer Boots",
            "tool": "Farmer Pitchfork"
          }
        },
        "crops": {
          "1": {
            "createdAt": 1755990000000,
            "x": -2,
            "y": 0,
            "crop": {
              "name": "Sunflower",
              "plantedAt": 1756100000000
            }
          }
        },
        "trees": {
          "1": {
            "wood": {
              amount: 1,
              choppedAt: 1756090000000
            },
            "x": -3,
            "y": 3
          }
        },
        "buildings": {
          "Fire Pit": [
            {
              "id": "123",
              "coordinates": {
                "x": 4,
                "y": 8
              },
              "readyAt": 0,
              "createdAt": 0
            }
          ]
        },
        "...": "trimmed — a real farm object contains many more fields"
      }
    },
    {
      "id": 121501,
      "farm": {
        "...": "another farm object"
      }
    }
  ],
  "next_cursor": "eyJpZCI6MTIxNTAxfQ"
}
```

### Errors
- **401 Unauthorized:** Missing or invalid API key.
  - Description: Sent when `x-api-key` is absent, fails verification, or belongs to a farm that no longer meets the requirements.
  - Response Body:
    ```json
    {
      "error": "API key is required - get one at https://sunflower-land.com/community-docs (requires VIP and level 50+)"
    }
    ```
- **429 Too Many Requests:** Too many requests.
  - Description: Per-IP throttle: roughly one request per 5 seconds per endpoint, doubling to 10 seconds if you keep hammering.

## 2. Get farms by id (legacy) (`POST /community/getFarms`)

### Description
Deprecated batch lookup: up to 100 farm ids in one POST. Kept working for the integrations built against it before pagination existed. New code should use List farms for slices and the Nightly farm dump for the whole dataset.
Takes an array of farm ids in the request body and returns those farms in one response. This is the only endpoint that fetches an arbitrary set of ids in a single call.
The response shape is its own: farms is an object keyed by farm id (not an array), each value being the farm object itself rather than an `{ id, farm }` wrapper. Any id missing from it is listed in `skipped`.
Send no ids and the endpoint behaves exactly like List farms.

### Request
- **Method:** `POST`
- **URL:** `https://api.sunflower-land.com/community/getFarms`
- **Headers:**
  - `x-api-key`: `sfl.YOUR.KEY` (Required)
  - `content-type`: `application/json`
- **Query Parameters (Only used when body has no ids):**
  - `limit` (integer, optional)
  - `cursor` (string, optional)
- **Body (JSON, optional):**
  - `ids` (array of integers): Farm ids to fetch (1-100).
  ```json
  {
    "ids": [121500, 121501]
  }
  ```

### Response (200 OK)
```json
{
  "farms": {
    "121500": {
      "balance": "1250.421",
      "coins": 128350,
      "inventory": {
        "Basic Land": "9",
        "Sunflower Seed": "204",
        "Sunflower": "120",
        "Wood": "56.5",
        "Stone": "23",
        "Axe": "3",
        "Water Well": "1"
      },
      "wardrobe": {
        "Basic Hair": 1,
        "Red Farmer Shirt": 1,
        "Farmer Overalls": 1
      },
      "bumpkin": {
        "id": 5321,
        "experience": 105300,
        "equipped": {
          "hair": "Basic Hair",
          "shirt": "Red Farmer Shirt",
          "pants": "Farmer Overalls",
          "background": "Farm Background",
          "body": "Beige Farmer Potion",
          "shoes": "Black Farmer Boots",
          "tool": "Farmer Pitchfork"
        }
      },
      "crops": {
        "1": {
          "createdAt": 1755990000000,
          "x": -2,
          "y": 0,
          "crop": {
            "name": "Sunflower",
            "plantedAt": 1756100000000
          }
        }
      },
      "trees": {
        "1": {
          "wood": {
            "amount": 1,
            "choppedAt": 1756090000000
          },
          "x": -3,
          "y": 3
        }
      },
      "buildings": {
        "Fire Pit": [
          {
            "id": "123",
            "coordinates": {
              "x": 4,
              "y": 8
            },
            "readyAt": 0,
            "createdAt": 0
          }
        ]
      },
      "isBlacklisted": false,
      "updatedAt": "2026-08-27T21:14:03.221Z"
    },
    "121501": {
      "...": "another farm object"
    }
  },
  "skipped": [
    999999999
  ],
  "warning": "This endpoint is deprecated. Please use pagination"
}
```

### Errors
None documented.

## 3. Get a farm (`GET /community/farms/{id}`)

### Description
Fetch one farm by farm/NFT id or linked wallet address. Returns a single farm: its account id, NFT id (when linked), the full farm object, whether the account is blacklisted, and updatedAt.
The id path parameter is flexible: a numeric id up to 1,000,000,000 is resolved as an NFT id; a larger number as an account id; a 0x… value as a linked wallet address.

### Request
- **Method:** `GET`
- **URL:** `https://api.sunflower-land.com/community/farms/{id}`
- **Headers:**
  - `x-api-key`: `sfl.YOUR.KEY` (Required)
- **Path Parameters:**
  - `id` (string, required): Farm NFT id (≤ 1,000,000,000), account id (> 1,000,000,000), or linked wallet address (0x…).

### Response (200 OK)
```json
{
  "farm": {
    "balance": "1250.421",
    "coins": 128350,
    "inventory": {
      "Basic Land": "9",
      "Sunflower Seed": "204",
      "Sunflower": "120",
      "Wood": "56.5",
      "Stone": "23",
      "Axe": "3",
      "Water Well": "1"
    },
    "wardrobe": {
      "Basic Hair": 1,
      "Red Farmer Shirt": 1,
      "Farmer Overalls": 1
    },
    "bumpkin": {
      "id": 5321,
      "experience": 105300,
      "equipped": {
        "hair": "Basic Hair",
        "shirt": "Red Farmer Shirt",
        "pants": "Farmer Overalls",
        "background": "Farm Background",
        "body": "Beige Farmer Potion",
        "shoes": "Black Farmer Boots",
        "tool": "Farmer Pitchfork"
      }
    },
    "crops": {
      "1": {
        "createdAt": 1755990000000,
        "x": -2,
        "y": 0,
        "crop": {
          "name": "Sunflower",
          "plantedAt": 1756100000000
        }
      }
    },
    "trees": {
      "1": {
        "wood": {
          "amount": 1,
          "choppedAt": 1756090000000
        },
        "x": -3,
        "y": 3
      }
    },
    "buildings": {
      "Fire Pit": [
        {
          "id": "123",
          "coordinates": {
            "x": 4,
            "y": 8
          },
          "readyAt": 0,
          "createdAt": 0
        }
      ]
    },
    "...": "trimmed — a real farm object contains many more fields"
  },
  "id": 121500,
  "nft_id": 29411,
  "nftId": 29411,
  "isBlacklisted": false,
  "updatedAt": "2026-08-25T03:12:44.000Z"
}
```

### Errors
None documented.

## 4. List auctions (`GET /community/data?type=auctions`)

### Description
Every Auctioneer drop — schedule, cost and supply.
Returns every auction the Auctioneer has ever run or will run — past, live and upcoming — plus `totalSupply`, the lifetime max supply of each auctionable item. Use it to build drop calendars, reminders and supply trackers.
Auctions are ordered by `startAt`, oldest first. Internal test drops are filtered out.

### Request
- **Method:** `GET`
- **URL:** `https://api.sunflower-land.com/community/data`
- **Headers:**
  - `x-api-key`: `sfl.YOUR.KEY` (Required)
- **Query Parameters:**
  - `type` (string, required): Must be `auctions`.

### Response (200 OK)
```json
{
  "data": {
    "auctions": [
      {
        "auctionId": "coin-aura-2024-08-07-drop-1",
        "type": "wearable",
        "wearable": "Coin Aura",
        "startAt": 1723017600000,
        "endAt": 1723021200000,
        "supply": 1,
        "sfl": 1,
        "ingredients": {},
        "chapterLimit": 1
      },
      {
        "auctionId": "pet-2025-10-08-drop-1",
        "type": "nft",
        "nft": "Pet",
        "startId": 2,
        "startAt": 1759895880000,
        "endAt": 1759899480000,
        "supply": 10,
        "sfl": 1,
        "ingredients": {
          "Gold": 5
        },
        "chapterLimit": 7
      },
      {
        "...": "one entry per auction"
      }
    ],
    "totalSupply": {
      "Coin Aura": 100,
      "Rocket Onesie": 250,
      "...": "one entry per auctionable item"
    }
  }
}
```

### Errors
- **400 Bad Request:** Invalid request.
  - Description: The query string failed validation — an unknown type, or extra parameters this type doesn't accept. Empty body.
- **401 Unauthorized:** Missing or invalid API key.
  - Response Body:
    ```json
    {
      "error": "API key is required - get one at https://sunflower-land.com/community-docs (requires VIP and level 50+)"
    }
    ```
- **429 Too Many Requests:** Too many requests.
  - Description: Per-IP throttle: roughly one request per 5 seconds, doubling to 10 seconds if you keep hammering. Back off and retry.

## 5. Auction results (`GET /community/data?type=auctionResults`)

### Description
Leaderboard and participant count for one auction.
Returns the outcome of a single auction: its status, how many farms bid, the drop's supply, its `endAt`, and the leaderboard of bids ranked best to worst.
`status` is `pending` while the auction is still open (and for a short buffer after it closes) — the leaderboard is empty and `participantCount` is absent until the winners are picked. Once it is complete the leaderboard is filled in.
Each leaderboard row carries `rank`, the `farmId` and `username` of the bidder, and the bid itself: `tickets`, `experience`, `sfl` and `items`. The top supply ranks are the winners.
`username` is omitted for farms that haven't set one.

### Request
- **Method:** `GET`
- **URL:** `https://api.sunflower-land.com/community/data`
- **Headers:**
  - `x-api-key`: `sfl.YOUR.KEY` (Required)
- **Query Parameters:**
  - `type` (string, required): Must be `auctionResults`.
  - `auctionId` (string, required): The auction's id, exactly as returned by List auctions (e.g. `coin-aura-2024-08-07-drop-1`).

### Response (200 OK)
```json
{
  "data": {
    "status": "complete",
    "participantCount": 214,
    "supply": 5,
    "endAt": 1723021200000,
    "leaderboard": [
      {
        "rank": 1,
        "farmId": 121500,
        "username": "gordy",
        "tickets": 850,
        "experience": 1250340,
        "sfl": 1,
        "items": {
          "Gold": 5
        }
      },
      {
        "rank": 2,
        "farmId": 98211,
        "tickets": 850,
        "experience": 940120,
        "sfl": 1,
        "items": {
          "Gold": 5
        }
      },
      {
        "...": "one row per ranked bid"
      }
    ]
  }
}
```

### Errors
- **400 Bad Request:** Invalid request.
  - Description: `auctionId` is missing, or the query string failed validation. Empty body.
- **401 Unauthorized:** Missing or invalid API key.
  - Response Body:
    ```json
    {
      "error": "API key is required - get one at https://sunflower-land.com/community-docs (requires VIP and level 50+)"
    }
    ```
- **404 Not Found:** Auction not found.
  - Description: No auction matches the `auctionId` — also returned for internal test drops, which this API hides. Check the id against List auctions. Empty body.
- **429 Too Many Requests:** Too many requests.
  - Description: Per-IP throttle: roughly one request per 5 seconds, doubling to 10 seconds if you keep hammering. Back off and retry.

## 6. Marketplace activity (`GET /community/data?type=marketplaceActivity`)

### Description
Daily marketplace trading report: totals and per-item stats.
Returns the marketplace trading report for a day: overall volume and trade count, plus per-item stats — low, high and latest unit price, traded volume, number of trades and quantity moved. All prices and volumes are denominated in FLOWER; `flowerPrice` gives the current USD price of FLOWER.
Each item also carries a market snapshot: `floor` (cheapest active listing), `listingCount`, `offerCount` and `bestOffer` (highest active offer). `floor` and `bestOffer` are omitted when empty.
Items are keyed by collection and item id (e.g. `collectibles-601`).
Omit `date` to get the live running report for today; pass a `YYYY-MM-DD` date for that day's snapshot.

### Request
- **Method:** `GET`
- **URL:** `https://api.sunflower-land.com/community/data`
- **Headers:**
  - `x-api-key`: `sfl.YOUR.KEY` (Required)
- **Query Parameters:**
  - `type` (string, required): Must be `marketplaceActivity`.
  - `date` (string, optional): Day to fetch as `YYYY-MM-DD` (UTC).

### Response (200 OK)
```json
{
  "data": {
    "flowerPrice": 0.13458,
    "reports": {
      "2026-08-31": {
        "totals": {
          "volume": 75628761.49,
          "trades": 15314834
        },
        "items": {
          "collectibles-601": {
            "low": 0.0000017,
            "high": 150,
            "volume": 3541962.54,
            "trades": 1078763,
            "quantity": 172625521,
            "latestSale": 0.00985,
            "floor": 0.0098,
            "listingCount": 52,
            "offerCount": 34,
            "bestOffer": 0.0095
          },
          "collectibles-415": {
            "low": 1,
            "high": 600,
            "volume": 395716,
            "trades": 1105,
            "quantity": 1105,
            "latestSale": 264,
            "floor": 259,
            "listingCount": 3,
            "offerCount": 1,
            "bestOffer": 255
          },
          "pets-2513": {
            "volume": 0,
            "trades": 0,
            "quantity": 0,
            "floor": 45,
            "listingCount": 2,
            "offerCount": 0
          },
          "...": "one entry per item ever traded or currently on the market"
        }
      }
    }
  }
}
```

### Errors
- **400 Bad Request:** Invalid request.
  - Description: `date` is not a valid `YYYY-MM-DD` string, or the query string failed validation. Empty body.
- **401 Unauthorized:** Missing or invalid API key.
  - Response Body:
    ```json
    {
      "error": "API key is required - get one at https://sunflower-land.com/community-docs (requires VIP and level 50+)"
    }
    ```
- **429 Too Many Requests:** Too many requests.
  - Description: Per-IP throttle: roughly one request per 5 seconds, doubling to 10 seconds if you keep hammering. Back off and retry.

## 7. Marketplace item (`GET /community/data?type=tradeable`)

### Description
Floor price, supply, open trades and sale history for one item.
Returns the marketplace page for a single tradeable: its floor price, last sale price, circulating supply, whether it can currently be traded, every open offer and listing, and its sale history.
`collection` picks the item type: `collectibles`, `wearables`, `buds` or `pets`. `collectibles` and `wearables` are keyed by the game's item ids; `buds` and `pets` are keyed by NFT id.
`offers` and `listings` are the 50 best open trades on each side.
`history` holds the last seven days of daily low, high, volume and sale count, the ten most recent fulfilled sales, and lifetime `totalSales` and `totalVolume`.

### Request
- **Method:** `GET`
- **URL:** `https://api.sunflower-land.com/community/data`
- **Headers:**
  - `x-api-key`: `sfl.YOUR.KEY` (Required)
- **Query Parameters:**
  - `type` (string, required): Must be `tradeable`.
  - `collection` (string, required): Which marketplace collection the item belongs to: `collectibles`, `wearables`, `buds` or `pets`.
  - `id` (integer, required): The item id within that collection (for buds and pets, the NFT id).

### Response (200 OK)
```json
{
  "data": {
    "id": 601,
    "collection": "collectibles",
    "floor": 0.0098,
    "lastSalePrice": 0.0102,
    "supply": 172625521,
    "isActive": true,
    "isVip": false,
    "offerCount": 34,
    "listingCount": 52,
    "offers": [
      {
        "tradeId": "66f2c1a4d4b2a10012a3f901",
        "sfl": 0.0095,
        "quantity": 1000,
        "offeredById": 121500,
        "offeredAt": 1756100000000,
        "type": "instant"
      },
      {
        "...": "up to 50 offers, best price first"
      }
    ],
    "listings": [
      {
        "id": "66f2c1a4d4b2a10012a3f902",
        "sfl": 0.0098,
        "quantity": 500,
        "listedById": 98211,
        "listedAt": 1756101000000,
        "type": "instant"
      },
      {
        "...": "up to 50 listings, best price first"
      }
    ],
    "history": {
      "sales": [
        {
          "id": "66f2c1a4d4b2a10012a3f903",
          "sfl": 0.0102,
          "quantity": 250,
          "itemId": 601,
          "collection": "collectibles",
          "fulfilledAt": 1756102000000,
          "fulfilledBy": {
            "id": 98211,
            "username": "gordy"
          },
          "initiatedBy": {
            "id": 121500
          },
          "source": "listing"
        },
        {
          "...": "the 10 most recent sales"
        }
      ],
      "history": {
        "totalSales": 1078763,
        "totalVolume": 3541962.54,
        "lastSale": {
          "sfl": 0.0102,
          "soldAt": 1756102000000
        },
        "dates": {
          "2026-08-26": {
            "date": "2026-08-26",
            "low": 0.0091,
            "high": 0.0121,
            "volume": 1842.31,
            "sales": 640
          },
          "...": "one entry per day, 7 days"
        }
      }
    }
  }
}
```

### Errors
- **400 Bad Request:** Invalid request.
  - Description: `collection` or `id` is missing, `collection` is not one of `collectibles`, `wearables`, `buds` or `pets`, or `id` is not a whole number. Empty body.
- **401 Unauthorized:** Missing or invalid API key.
  - Response Body:
    ```json
    {
      "error": "API key is required - get one at https://sunflower-land.com/community-docs (requires VIP and level 50+)"
    }
    ```
- **404 Not Found:** Item not tradeable.
  - Description: No tradeable item has that id in that collection — either the id doesn't exist, or the item has never been released for trading. Empty body.
- **429 Too Many Requests:** Too many requests.
  - Description: Per-IP throttle: roughly one request per 5 seconds, doubling to 10 seconds if you keep hammering. Back off and retry.

## 8. Marketplace profile (`GET /community/data?type=marketplaceProfile`)

### Description
Marketplace profile for a farm: listings, offers, recent trades and top trading partners.
Returns the marketplace profile for a single farm: its username, level, ascension, Bumpkin token URI, lifetime trades and profit, rolling 7-day volume spent and earned, all open listings and offers, top five trading partners by trade count, and the 50 most recent trades.
`profit` is the farm's lifetime FLOWER total across every trade it has settled.
`weeklyFlowerSpent` and `weeklyFlowerEarned` cover a rolling seven days.
`friends` are the five farms this one has traded with most.
`username` is omitted for farms that haven't set one.

### Request
- **Method:** `GET`
- **URL:** `https://api.sunflower-land.com/community/data`
- **Headers:**
  - `x-api-key`: `sfl.YOUR.KEY` (Required)
- **Query Parameters:**
  - `type` (string, required): Must be `marketplaceProfile`.
  - `farmId` (integer, required): The farm to profile. Any farm.

### Response (200 OK)
```json
{
  "data": {
    "id": 24601,
    "username": "gordy",
    "level": 74,
    "ascension": 1,
    "tokenUri": "v2_1_4_20_209_208_16_18",
    "totalTrades": 1842,
    "profit": 15204.6,
    "weeklyFlowerSpent": 412.85,
    "weeklyFlowerEarned": 638.2,
    "listings": {
      "66f2c1a4d4b2a10012a3f902": {
        "items": {
          "Sunflower": 500
        },
        "sfl": 5,
        "tax": 0.5,
        "teamTax": 0.25,
        "collection": "collectibles",
        "createdAt": 1756101000000,
        "tradeType": "instant"
      },
      "...": "one entry per open listing"
    },
    "offers": {
      "66f2c1a4d4b2a10012a3f901": {
        "items": {
          "Immortal Pear": 1
        },
        "sfl": 264,
        "collection": "collectibles",
        "createdAt": 1756100000000,
        "tradeType": "instant"
      },
      "...": "one entry per open offer"
    },
    "friends": [
      {
        "id": 98211,
        "username": "farmer_pete",
        "tokenUri": "v2_3_7_15_204_207_16",
        "trades": 61
      },
      {
        "...": "up to 5, most traded with first"
      }
    ],
    "trades": [
      {
        "id": "66f2c1a4d4b2a10012a3f903",
        "sfl": 264,
        "quantity": 1,
        "itemId": 415,
        "collection": "collectibles",
        "source": "listing",
        "fulfilledAt": 1756102000000,
        "initiatedBy": {
          "id": 24601,
          "username": "gordy",
          "bumpkinUri": "v2_1_4_20_209_208_16_18"
        },
        "fulfilledBy": {
          "id": 98211,
          "username": "farmer_pete",
          "bumpkinUri": "v2_3_7_15_204_207_16"
        }
      },
      {
        "...": "the 50 most recent trades, newest first"
      }
    ]
  }
}
```

### Errors
- **400 Bad Request:** Invalid request.
  - Description: `farmId` is missing, is not a whole number, or is not greater than zero. Empty body.
- **401 Unauthorized:** Missing or invalid API key.
  - Response Body:
    ```json
    {
      "error": "API key is required - get one at https://sunflower-land.com/community-docs (requires VIP and level 50+)"
    }
    ```
- **404 Not Found:** No such farm.
  - Description: No farm has that id. Empty body.
- **429 Too Many Requests:** Too many requests.
  - Description: Per-IP throttle: roughly one request per 5 seconds, doubling to 10 seconds if you keep hammering. Back off and retry.

## 9. Ticket leaderboard (`GET /community/data?type=ticketLeaderboard`)

### Description
The current chapter's ticket rankings, plus one farm's position.
Returns the chapter ticket leaderboard: `topTen` (highest ranked farms, up to limit), `total` (tickets crafted across the whole game this chapter), and `lastUpdated` (unix epoch of last rebuild).
`farmRankingDetails` shows the ranking of the requested farm, including a 3-row slice (above and below) if not in the top ten. It is omitted if in the top ten, and null if no tickets were crafted.

### Request
- **Method:** `GET`
- **URL:** `https://api.sunflower-land.com/community/data`
- **Headers:**
  - `x-api-key`: `sfl.YOUR.KEY` (Required)
- **Query Parameters:**
  - `type` (string, required): Must be `ticketLeaderboard`.
  - `farmId` (integer, required): The farm to report a position for.
  - `limit` (integer, optional): How many ranked farms to return in `topTen` (1-500, default 50).

### Response (200 OK)
```json
{
  "data": {
    "topTen": [
      {
        "rank": 1,
        "id": "gordy",
        "count": 8420,
        "accountId": 121500,
        "farmId": 121500,
        "nftId": 29411,
        "experience": 1250340,
        "ascensionLevel": 2,
        "bumpkin": {
          "hair": "Basic Hair",
          "shirt": "Red Farmer Shirt"
        }
      },
      {
        "...": "one row per rank, up to limit"
      }
    ],
    "farmRankingDetails": [
      {
        "rank": 61,
        "id": "#98210",
        "count": 1204,
        "accountId": 98210
      },
      {
        "rank": 62,
        "id": "sunny",
        "count": 1198,
        "accountId": 62559
      },
      {
        "rank": 63,
        "id": "pip",
        "count": 1180,
        "accountId": 98212
      }
    ],
    "lastUpdated": 1756100400000,
    "total": 41288390
  }
}
```

### Errors
- **400 Bad Request:** Invalid request.
  - Description: `farmId` is missing or not a positive number, or `limit` is outside 1-500. Empty body.
- **401 Unauthorized:** Missing or invalid API key.
  - Response Body:
    ```json
    {
      "error": "API key is required - get one at https://sunflower-land.com/community-docs (requires VIP and level 50+)"
    }
    ```
- **404 Not Found:** Leaderboard not found.
  - Description: The farm doesn't exist, or no board has been generated for the current chapter yet. Empty body.
- **429 Too Many Requests:** Too many requests.
  - Description: Per-IP throttle: roughly one request per 5 seconds, doubling to 10 seconds if you keep hammering. Back off and retry.

## 10. Discord announcements (`GET /community/data?type=discordAnnouncements`)

### Description
The 20 most recent posts from the official Discord.
Returns the 20 latest announcements collected from Sunflower Land's official Discord announcement channels, newest first.

### Request
- **Method:** `GET`
- **URL:** `https://api.sunflower-land.com/community/data`
- **Headers:**
  - `x-api-key`: `sfl.YOUR.KEY` (Required)
- **Query Parameters:**
  - `type` (string, required): Must be `discordAnnouncements`.

### Response (200 OK)
```json
{
  "data": [
    {
      "id": "1409928315000123456",
      "channelId": "907864376689283085",
      "channelName": "announcements",
      "url": "https://discord.com/channels/880987707214544966/907864376689283085/1409928315000123456",
      "content": "**Chapter Update** is live! Head to the Plaza to pick up your first delivery.",
      "sender": {
        "id": "512300000000000000",
        "username": "sunflowerbot",
        "displayName": "Sunflower Land",
        "avatarUrl": "https://cdn.discordapp.com/avatars/…/….png"
      },
      "createdAt": "2026-08-26T04:12:09.000Z",
      "images": [
        {
          "url": "https://cdn.discordapp.com/attachments/…/chapter.png",
          "filename": "chapter.png",
          "contentType": "image/png",
          "width": 1200,
          "height": 630
        }
      ],
      "likes": 148
    },
    {
      "...": "up to 20 messages, newest first"
    }
  ]
}
```

### Errors
- **401 Unauthorized:** Missing or invalid API key.
  - Response Body:
    ```json
    {
      "error": "API key is required - get one at https://sunflower-land.com/community-docs (requires VIP and level 50+)"
    }
    ```
- **429 Too Many Requests:** Too many requests.
  - Description: Per-IP throttle: roughly one request per 5 seconds, doubling to 10 seconds if you keep hammering. Back off and retry.

## 11. List raffles (`GET /community/data?type=raffles`)

### Description
Every raffle — its window, prize table and entry costs.
Returns every raffle the game has run or has scheduled, as an array.
`prizes` is keyed by finishing position (1 is top prize). Each prize names its type (`collectible`, `wearable`, `Pet`, or `Bud`). `onChain: true` marks prizes minted to the winner's wallet.
`entryRequirements` lists the items that buy entries and how many entries each is worth.

### Request
- **Method:** `GET`
- **URL:** `https://api.sunflower-land.com/community/data`
- **Headers:**
  - `x-api-key`: `sfl.YOUR.KEY` (Required)
- **Query Parameters:**
  - `type` (string, required): Must be `raffles`.

### Response (200 OK)
```json
{
  "data": [
    {
      "id": "crabs-raffle-2026-02-02",
      "startAt": 1769990400000,
      "endAt": 1770595200000,
      "prizes": {
        "1": {
          "type": "wearable",
          "wearables": {
            "Crimstone Spikes Hair": 1
          },
          "onChain": true
        },
        "2": {
          "type": "Pet",
          "nft": "Pet #2501",
          "onChain": true
        },
        "3": {
          "type": "collectible",
          "items": {
            "Gem": 2000
          }
        },
        "...": "one entry per prize position"
      },
      "entryRequirements": {
        "Floater": 10,
        "Crabs and Traps Raffle Ticket": 1
      }
    },
    {
      "...": "one entry per raffle"
    }
  ]
}
```

### Errors
- **401 Unauthorized:** Missing or invalid API key.
  - Response Body:
    ```json
    {
      "error": "API key is required - get one at https://sunflower-land.com/community-docs (requires VIP and level 50+)"
    }
    ```
- **429 Too Many Requests:** Too many requests.
  - Description: Per-IP throttle: roughly one request per 5 seconds, doubling to 10 seconds if you keep hammering. Back off and retry.

## 12. Raffle results (`GET /community/data?type=raffleResults`)

### Description
Winners, entry counts and participants for one raffle.
Returns the outcome of a single raffle.
`status` is `pending` (until draw runs, with empty winners array and zeroed counts) or `complete`.
`winners` are listed in prize order, showing their farmId, position, entries held, onChain status, prize (under `items`, `wearables`, or `nft`), and profile.

### Request
- **Method:** `GET`
- **URL:** `https://api.sunflower-land.com/community/data`
- **Headers:**
  - `x-api-key`: `sfl.YOUR.KEY` (Required)
- **Query Parameters:**
  - `type` (string, required): Must be `raffleResults`.
  - `id` (string, required): The raffle's id, exactly as returned by List raffles (e.g. `crabs-raffle-2026-02-02`).

### Response (200 OK)
```json
{
  "data": {
    "status": "complete",
    "raffleId": "crabs-raffle-2026-02-02",
    "endAt": 1770595200000,
    "participants": 3184,
    "entries": 91240,
    "winners": [
      {
        "farmId": 121500,
        "position": 1,
        "entries": 320,
        "ticketsUsed": 320,
        "onChain": true,
        "type": "wearable",
        "wearables": {
          "Crimstone Spikes Hair": 1
        },
        "profile": {
          "username": "gordy",
          "level": 84,
          "ascension": 2,
          "equipped": {
            "hair": "Basic Hair",
            "shirt": "Red Farmer Shirt"
          }
        }
      },
      {
        "...": "one entry per prize position"
      }
    ]
  }
}
```

### Errors
- **400 Bad Request:** Invalid request.
  - Description: `id` is missing, or the query string failed validation. Empty body.
- **401 Unauthorized:** Missing or invalid API key.
  - Response Body:
    ```json
    {
      "error": "API key is required - get one at https://sunflower-land.com/community-docs (requires VIP and level 50+)"
    }
    ```
- **404 Not Found:** Raffle not found.
  - Description: No raffle matches the id. Check it against List raffles. Empty body.
- **429 Too Many Requests:** Too many requests.
  - Description: Per-IP throttle: roughly one request per 5 seconds, doubling to 10 seconds if you keep hammering. Back off and retry.

## 13. Nightly farm dump (`GET /community/data?type=nightlyDump`)

### Description
Every farm in one file. The right way to fetch the whole dataset.
Once a day the entire farms database is exported to newline-delimited JSON and gzipped.
This endpoint returns the manifest: every file currently published, each with its filename, size in bytes and modifiedAt timestamp. Files are keyed by UTC date: `{YYYY-MM-DD}/all.jsonl.gz` and `{YYYY-MM-DD}/active.jsonl.gz`. Only the last 7 days are kept.
The files themselves are then downloaded from `https://community.sunflower-land.com/{filename}` (a plain CDN, no key and no rate limit). Only the manifest requires an API key.

`all` contains every account. `active` is filtered to farms that have played in the last 90 days.
Each line of either file is one farm: `{ id, nftId, farm, isBlacklisted, lastActivity }`, where `farm` is the same visit-prepared game state.

### Request
- **Method:** `GET`
- **URL:** `https://api.sunflower-land.com/community/data`
- **Headers:**
  - `x-api-key`: `sfl.YOUR.KEY` (Required)
- **Query Parameters:**
  - `type` (string, required): Must be `nightlyDump`.

### Response (200 OK)
```json
{
  "data": [
    {
      "filename": "2026-08-25/active.jsonl.gz",
      "size": 782905552,
      "modifiedAt": "2026-08-25T22:00:59.000Z"
    },
    {
      "filename": "2026-08-25/all.jsonl.gz",
      "size": 2140507162,
      "modifiedAt": "2026-08-25T22:00:41.000Z"
    },
    {
      "...": "one pair per day still inside the 7 day window"
    }
  ]
}
```

### Errors
- **401 Unauthorized:** Missing or invalid API key.
  - Response Body:
    ```json
    {
      "error": "API key is required - get one at https://sunflower-land.com/community-docs (requires VIP and level 50+)"
    }
    ```
- **429 Too Many Requests:** Too many requests.
  - Description: Per-IP throttle on the manifest: roughly one request per 5 seconds, doubling to 10 seconds if you keep hammering. The file downloads themselves are not throttled.
- **403 Forbidden (from CDN):** File expired or wrong path.
  - Description: Downloading a file the manifest doesn't list answers 403, not 404 — usually a dump older than 7 days, or a date that was never published.



