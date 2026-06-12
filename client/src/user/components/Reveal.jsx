import { useEffect, useRef, useState } from "react";

function getInitialVisibility() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function Reveal({ className = "", children, delay = 0, once = true, threshold = 0.18, ...props }) {
  const elementRef = useRef(null);
  const [isVisible, setIsVisible] = useState(getInitialVisibility);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const element = elementRef.current;

    if (!element) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);

          if (once) {
            observer.disconnect();
          }
        } else if (!once) {
          setIsVisible(false);
        }
      },
      {
        rootMargin: "0px 0px -10% 0px",
        threshold,
      }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [once, threshold]);

  return (
    <div
      ref={elementRef}
      className={`ember-reveal${isVisible ? " is-visible" : ""}${className ? ` ${className}` : ""}`}
      style={{ "--reveal-delay": `${delay}s` }}
      {...props}
    >
      {children}
    </div>
  );
}

export default Reveal;
