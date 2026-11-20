type Props = { reason: 'missing' | 'placeholder' | 'secret' | 'invalid' };

const messages: Record<Props['reason'], string> = {
  missing: 'No Mapbox token found.',
  placeholder: 'The token in .env.local is still the example placeholder.',
  secret: 'That is a SECRET token (sk.). Never put secret tokens in a website. Use your PUBLIC token (pk.) instead.',
  invalid: 'That does not look like a Mapbox public token. It should start with "pk.".',
};

/** Friendly setup screen shown when the Mapbox token is missing or wrong. */
export function TokenNotice({ reason }: Props) {
  return (
    <div className="nn-notice">
      <div className="nn-card">
        <h1>Terus setup needed</h1>
        <p>{messages[reason]}</p>
        <p>
          Create a file called <code>.env.local</code> in the Terus folder containing:
          <br />
          <code>VITE_MAPBOX_TOKEN=pk.your_token</code>
        </p>
        <p>Then stop the server (Ctrl + C) and run <code>npm run dev</code> again.</p>
      </div>
    </div>
  );
}
