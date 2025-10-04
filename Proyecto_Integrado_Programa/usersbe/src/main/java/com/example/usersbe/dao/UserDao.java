package com.example.usersbe.dao;

import org.springframework.data.mongodb.repository.MongoRepository;
import com.example.usersbe.model.User; 

public interface UserDao extends MongoRepository<User, String> {


    User findByEmailAndPwd(String email, String pwd);

    User findByEmail(String email);
}
