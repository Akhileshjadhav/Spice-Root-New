import { FiMoon, FiSun } from "react-icons/fi";
import { useTheme } from "../context/useTheme";

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={isDark ? "Switch to normal mode" : "Switch to night mode"}
      title={isDark ? "Normal mode" : "Night mode"}
      onClick={toggleTheme}
    >
      <span className="theme-toggle-track" aria-hidden="true">
        <span className="theme-toggle-thumb">
          {isDark ? <FiMoon /> : <FiSun />}
        </span>
      </span>
    </button>
  );
}

export default ThemeToggle;
