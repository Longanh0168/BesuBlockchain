import jwt
import time
import sys

# Hàm sinh JWT
def generate_jwt(private_key_path, subject="powershell-client", expiry_seconds=3600):
    """
    Generates a JWT token using an RSA private key.

    Args:
        private_key_path (str): Path to the jwt_private.pem file.
        subject (str): The 'sub' claim value (identifies the client).
        expiry_seconds (int): Number of seconds the token will be valid from creation time.

    Returns:
        str: The generated JWT token string.
        None: If an error occurs.
    """
    try:
        # Read the private key from the file
        with open(private_key_path, 'r') as f:
            private_key = f.read()

        # Calculate issued at (iat) and expiration (exp) times
        issued_at = int(time.time())
        expires_at = issued_at + expiry_seconds # Token expires after expiry_seconds

        # Create the payload for the JWT
        payload = {
            "sub": subject,       # Subject claim
            "iat": issued_at,     # Issued At claim
            "exp": expires_at     # Expiration Time claim
            # You can add other custom claims here if needed
        }

        # Encode (sign) the JWT using the private key and RS256 algorithm
        # 'RS256' is the standard algorithm for RSA signatures with SHA-256
        token = jwt.encode(payload, private_key, algorithm="RS256")

        return token

    except FileNotFoundError:
        print(f"Error: Private key file not found at {private_key_path}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"Error generating JWT: {e}", file=sys.stderr)
        return None

# Main execution block when the script is run directly
if __name__ == "__main__":
    # Check if the private key file path is provided as a command-line argument
    if len(sys.argv) != 2:
        print("Usage: python generate_jwt.py <path_to_private_key.pem>", file=sys.stderr)
        sys.exit(1) # Exit with error code 1 if usage is incorrect

    private_key_file = sys.argv[1] # Get the private key path from arguments

    # Generate the token
    token = generate_jwt(private_key_file)

    # Print the token to standard output
    # PowerShell will capture this output
    if token:
        print(token)
    else:
        sys.exit(1) # Exit with error code 1 if token generation failed