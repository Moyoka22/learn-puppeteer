{ pkgs ? import <nixpkgs> {} }:
with pkgs;
let 
  buildPackages = [ sqlite fish ];
in
  mkShell {
    shellHook =''
    echo "Shell loaded"
    exec fish
    '';
    inherit buildPackages;
  }
