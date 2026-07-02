import sys
import os

# Add the parent directory of mtef_py to the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from mtef_py.mtef import MTEF

if __name__ == '__main__':
    try:
        # Reconfigure standard streams to UTF-8
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except AttributeError:
        pass
    
    try:
        # Read all raw bytes from standard input
        ole_bytes = sys.stdin.buffer.read()
        if not ole_bytes:
            print("Error: No input received on stdin", file=sys.stderr)
            sys.exit(1)
            
        mtef, err = MTEF.OpenBytes(ole_bytes)
        if err is not None:
            print(f"Error parsing OLE stream: {err}", file=sys.stderr)
            sys.exit(1)
        if mtef is None:
            print("Error: parsed MTEF is None", file=sys.stderr)
            sys.exit(1)
            
        latex_str = mtef.Translate()
        # Output result to stdout
        print(latex_str)
    except Exception as e:
        print(f"Exception: {e}", file=sys.stderr)
        sys.exit(1)
