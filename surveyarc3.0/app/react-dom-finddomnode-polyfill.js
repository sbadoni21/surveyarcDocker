"use client";

import * as ReactDOM from "react-dom";

// React 19 removed findDOMNode – add a no-op so old libs don't crash.
if (!(ReactDOM ).findDOMNode) {
  (ReactDOM ).findDOMNode = () => null;
}

export {};
