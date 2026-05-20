import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { User, Lock, Mail, Github, Facebook, Linkedin, Chrome } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const LoginSignupForm = () => {
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(false);

  // login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // register state
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");

  const navigate = useNavigate();

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });
    if (error) {
      toast.error(error.message);
    } else {
      navigate("/dashboard");
    }
    setLoading(false);
  };

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: regEmail,
      password: regPassword,
      options: {
        emailRedirectTo: window.location.origin,
        data: regName ? { full_name: regName } : undefined,
      },
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Verifique seu email para confirmar o cadastro.");
    }
    setLoading(false);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');

        .lsf-wrapper, .lsf-wrapper * {
          box-sizing: border-box;
          font-family: "Poppins", sans-serif;
        }

        .lsf-wrapper {
          min-height: 100vh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(90deg, #e2e2e2, #c9d6ff);
          padding: 20px;
        }

        .lsf-container {
          position: relative;
          width: 850px;
          max-width: 100%;
          height: 550px;
          background: #fff;
          border-radius: 30px;
          box-shadow: 0 0 30px rgba(0, 0, 0, .2);
          overflow: hidden;
        }

        .lsf-container h1 {
          font-size: 36px;
          margin: -10px 0;
        }

        .lsf-container p {
          font-size: 14.5px;
          margin: 15px 0;
        }

        .lsf-form-box {
          position: absolute;
          right: 0;
          width: 50%;
          height: 100%;
          background: #fff;
          display: flex;
          align-items: center;
          color: #333;
          text-align: center;
          padding: 40px;
          z-index: 1;
          transition: .6s ease-in-out 1.2s, visibility 0s 1s;
        }

        .lsf-container.active .lsf-form-box {
          right: 50%;
        }

        .lsf-form-box.register {
          visibility: hidden;
        }

        .lsf-container.active .lsf-form-box.register {
          visibility: visible;
        }

        .lsf-form-box form { width: 100%; }

        .lsf-input-box {
          position: relative;
          margin: 30px 0;
        }

        .lsf-input-box input {
          width: 100%;
          padding: 13px 50px 13px 20px;
          background: #eee;
          border-radius: 8px;
          border: none;
          outline: none;
          font-size: 16px;
          color: #333;
          font-weight: 500;
        }

        .lsf-input-box input::placeholder {
          color: #888;
          font-weight: 400;
        }

        .lsf-input-box svg {
          position: absolute;
          right: 20px;
          top: 50%;
          transform: translateY(-50%);
          color: #888;
        }

        .lsf-forgot {
          margin: -15px 0 15px;
        }

        .lsf-forgot a {
          font-size: 14.5px;
          color: #333;
          text-decoration: none;
        }

        .lsf-btn {
          width: 100%;
          height: 48px;
          background: #7494ec;
          border-radius: 8px;
          box-shadow: 0 0 10px rgba(0, 0, 0, .1);
          border: none;
          cursor: pointer;
          font-size: 16px;
          color: #fff;
          font-weight: 600;
        }

        .lsf-btn:disabled { opacity: .7; cursor: not-allowed; }

        .lsf-social {
          display: flex;
          justify-content: center;
        }

        .lsf-social a {
          display: inline-flex;
          padding: 10px;
          border: 2px solid #ccc;
          border-radius: 8px;
          color: #333;
          margin: 0 8px;
          cursor: pointer;
        }

        .lsf-toggle-box {
          position: absolute;
          width: 100%;
          height: 100%;
        }

        .lsf-toggle-box::before {
          content: '';
          position: absolute;
          left: -250%;
          width: 300%;
          height: 100%;
          background: #7494ec;
          border-radius: 150px;
          z-index: 2;
          transition: 1.8s ease-in-out;
        }

        .lsf-container.active .lsf-toggle-box::before {
          left: 50%;
        }

        .lsf-toggle-panel {
          position: absolute;
          width: 50%;
          height: 100%;
          color: #fff;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          z-index: 2;
          transition: .6s ease-in-out;
          padding: 0 30px;
        }

        .lsf-toggle-panel.toggle-left {
          left: 0;
          transition-delay: 1.2s;
        }

        .lsf-container.active .lsf-toggle-panel.toggle-left {
          left: -50%;
          transition-delay: .6s;
        }

        .lsf-toggle-panel.toggle-right {
          right: -50%;
          transition-delay: .6s;
        }

        .lsf-container.active .lsf-toggle-panel.toggle-right {
          right: 0;
          transition-delay: 1.2s;
        }

        .lsf-toggle-panel p { margin-bottom: 20px; }

        .lsf-toggle-panel .lsf-btn {
          width: 160px;
          height: 46px;
          background: transparent;
          border: 2px solid #fff;
          box-shadow: none;
        }

        @media screen and (max-width: 650px) {
          .lsf-container { height: calc(100vh - 40px); }
          .lsf-form-box { bottom: 0; width: 100%; height: 70%; }
          .lsf-container.active .lsf-form-box { right: 0; bottom: 30%; }
          .lsf-toggle-box::before {
            left: 0; top: -270%; width: 100%; height: 300%; border-radius: 20vw;
          }
          .lsf-container.active .lsf-toggle-box::before { left: 0; top: 70%; }
          .lsf-container.active .lsf-toggle-panel.toggle-left { left: 0; top: -30%; }
          .lsf-toggle-panel { width: 100%; height: 30%; }
          .lsf-toggle-panel.toggle-left { top: 0; }
          .lsf-toggle-panel.toggle-right { right: 0; bottom: -30%; }
          .lsf-container.active .lsf-toggle-panel.toggle-right { bottom: 0; }
        }

        @media screen and (max-width: 400px) {
          .lsf-form-box { padding: 20px; }
          .lsf-toggle-panel h1 { font-size: 30px; }
        }
      `}</style>

      <div className="lsf-wrapper">
        <div className={`lsf-container ${isActive ? "active" : ""}`}>
          {/* Login */}
          <div className="lsf-form-box login">
            <form onSubmit={handleLogin}>
              <h1>Entrar</h1>
              <div className="lsf-input-box">
                <input
                  type="email"
                  placeholder="Email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                />
                <Mail size={20} />
              </div>
              <div className="lsf-input-box">
                <input
                  type="password"
                  placeholder="Senha"
                  required
                  minLength={6}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                />
                <Lock size={20} />
              </div>
              <div className="lsf-forgot">
                <a href="#">Esqueceu a senha?</a>
              </div>
              <button type="submit" className="lsf-btn" disabled={loading}>
                {loading ? "Aguarde..." : "Entrar"}
              </button>
              <p>ou entre com redes sociais</p>
              <div className="lsf-social">
                <a><Chrome size={22} /></a>
                <a><Facebook size={22} /></a>
                <a><Github size={22} /></a>
                <a><Linkedin size={22} /></a>
              </div>
            </form>
          </div>

          {/* Register */}
          <div className="lsf-form-box register">
            <form onSubmit={handleSignup}>
              <h1>Cadastro</h1>
              <div className="lsf-input-box">
                <input
                  type="text"
                  placeholder="Nome"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                />
                <User size={20} />
              </div>
              <div className="lsf-input-box">
                <input
                  type="email"
                  placeholder="Email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                />
                <Mail size={20} />
              </div>
              <div className="lsf-input-box">
                <input
                  type="password"
                  placeholder="Senha"
                  required
                  minLength={6}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                />
                <Lock size={20} />
              </div>
              <button type="submit" className="lsf-btn" disabled={loading}>
                {loading ? "Aguarde..." : "Cadastrar"}
              </button>
              <p>ou cadastre-se com redes sociais</p>
              <div className="lsf-social">
                <a><Chrome size={22} /></a>
                <a><Facebook size={22} /></a>
                <a><Github size={22} /></a>
                <a><Linkedin size={22} /></a>
              </div>
            </form>
          </div>

          {/* Toggle */}
          <div className="lsf-toggle-box">
            <div className="lsf-toggle-panel toggle-left">
              <h1>Olá, bem-vindo!</h1>
              <p>Não tem uma conta?</p>
              <button className="lsf-btn" onClick={() => setIsActive(true)} type="button">
                Cadastrar
              </button>
            </div>
            <div className="lsf-toggle-panel toggle-right">
              <h1>Bem-vindo de volta!</h1>
              <p>Já tem uma conta?</p>
              <button className="lsf-btn" onClick={() => setIsActive(false)} type="button">
                Entrar
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default LoginSignupForm;
