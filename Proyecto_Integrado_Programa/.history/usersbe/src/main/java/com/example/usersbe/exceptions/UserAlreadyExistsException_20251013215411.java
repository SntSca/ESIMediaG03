package com.example.usersbe.exceptions;

public class UserAlreadyExistsException {
        public UserAlreadyExistsException(String email) {
        super("El usuario ya existe: " + email);
    }
    
}
