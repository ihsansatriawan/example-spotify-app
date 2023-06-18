import React, { useState, useEffect } from "react";
import { generateRandomString, sha256, generateCodeChallenge } from "./utils";

const client_id = process.env.REACT_APP_SPOTIFY_CLIENT_ID;
const redirect_uri = "http://localhost:3000";
const authEndpoint = "https://accounts.spotify.com/authorize";
const tokenEndpoint = "https://accounts.spotify.com/api/token";
const scopes = ["user-read-private", "user-read-email", "user-modify-playback-state"];

function App() {
  const [accessToken, setAccessToken] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [currentTrack, setCurrentTrack] = useState(null);

  async function handleLogin() {
    const codeVerifier = generateRandomString(64);
    const codeChallenge = await generateCodeChallenge(codeVerifier)
    const pkceState = generateRandomString(16);


    // Store code verifier in session storage
    sessionStorage.setItem("codeVerifier", codeVerifier);
    sessionStorage.setItem("pkceState", pkceState);

    const queryParams = new URLSearchParams({
      client_id,
      response_type: "code",
      redirect_uri,
      code_challenge_method: "S256",
      code_challenge: codeChallenge,
      state: pkceState,
      scope: scopes.join(" "),
    });

    window.location = `${authEndpoint}?${queryParams}`;
  }


  function handleSearch(e) {
    e.preventDefault();
    const searchEndpoint = `https://api.spotify.com/v1/search?q=${encodeURIComponent(searchTerm)}&type=track`;
    fetch(searchEndpoint, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((response) => response.json())
      .then((data) => setSearchResults(data.tracks.items))
      .catch((error) => console.log(error));
  }

  function handleSearchTermChange(e) {
    setSearchTerm(e.target.value);
  }

  function renderSearchResults() {
    return (
      <ul>
        {searchResults.map((track) => (
          <li key={track.id}>
            {track.name} by {track.artists[0].name}
            <button onClick={() => {
              handlePlay(track.uri)
              setCurrentTrack(`${track.name} by ${track.artists[0].name}`); // Update the currentTrack state
            }}>Play</button>
          </li>
        ))}
      </ul>
    );
  }

  function handlePlay(trackUri) {
    const playEndpoint = "https://api.spotify.com/v1/me/player/play";
    fetch(playEndpoint, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ uris: [trackUri] }),
    }).catch((error) => console.log(error));
  }

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const state = urlParams.get("state");

    if (code && state) {
      // Exchange authorization code for access token
      exchangeCodeForToken(code, state);
    }
  }, []);

  async function exchangeCodeForToken(code, state) {
    const storedCodeVerifier = sessionStorage.getItem("codeVerifier");
    console.log("storedCodeVerifier: ", storedCodeVerifier)
    console.log("pkceState: ", sessionStorage.getItem("pkceState"))
    console.log("code: ", code)
    console.log("state: ", state)
    if (!storedCodeVerifier || state !== sessionStorage.getItem("pkceState")) {
      console.error("Invalid code verifier or state");
      return;
    }

    const requestBody = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri,
      client_id,
      code_verifier: storedCodeVerifier,
    });

    try {
      const response = await fetch(tokenEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: requestBody,
      });

      if (response.ok) {
        const data = await response.json();
        const { access_token } = data;
        setAccessToken(access_token);
      } else {
        console.error("Token exchange request failed");
      }
    } catch (error) {
      console.error("Error exchanging code for token", error);
    }
  }

  return (
    <div>
      {accessToken ? (
        <div>
          <form onSubmit={handleSearch}>
            <input type="text" value={searchTerm} onChange={handleSearchTermChange} />
            <button type="submit">Search</button>
          </form>
          {searchResults.length > 0 && renderSearchResults()}
          {currentTrack && <p>Now playing: {currentTrack}</p>} {/* Add the currently playing track */}
        </div>
      ) : (
        <button onClick={handleLogin}>Login with Spotify</button>
      )}
    </div>
  );
}

export default App;
