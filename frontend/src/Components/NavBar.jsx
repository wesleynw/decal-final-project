import { Link } from "react-router-dom";
import "../index.css";

const NavBar = () => {

  return (
    <nav>
      <ul>
        <li>
          <Link to="/Signup">Sign Up</Link>
        </li>
        <li>
          <Link to="/dashboard">Main Page</Link>
        </li>
      </ul>
    </nav>
  );
};

export default NavBar;
