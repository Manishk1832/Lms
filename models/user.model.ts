require('dotenv').config();
import mongoose, {Document, Model, Schema}  from "mongoose";
import bcrypt from 'bcryptjs'
import  Jwt  from "jsonwebtoken";

const emailRegexPattern: RegExp = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;


export interface IUser extends Document{
    name:string,
    email:string,
    password:string,
    avatar:{
        public_id:string,
        url:string;
    },
    role:string,
    isverified:boolean,
    courses:Array<{courseId: string}>,
    comparedPassword:(password:string) => Promise<boolean>;
    SignAccessToken:()=>string;
    SignRefreshToken:()=>string; 
}

const userSchema : Schema<IUser> = new mongoose.Schema({
    name: {
        type:String,
        required:[true,"Please enter your name"],
    },
    email: {
        type: String,
        required:[true, "Please enter your email"],
        validate:{
            validator: function(value:string){
                return emailRegexPattern.test(value);
            },
            message:"Please enter a valid email",
        },
        unique:true
    },
    password: {
    type: String,
    // required: [true, "Password is required"],
    minlength: [6, "Password must be at least 6 characters"],
    select: false
},
    avatar: {
        public_id:String,
        url:String,
    },
    role: {
        type:String,
        default:"user",
    },
    isverified: {
        type:Boolean,
        default:false,
    },
    courses:[{
        courseId:String,

    }],

},{timestamps:true});


//Hash  Password before saving
userSchema.pre<IUser>('save', async function(next){
    if(this.isModified('password')){
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
})

//sign access token
userSchema.methods.SignAccessToken = function (){
    return Jwt.sign({id: this._id},process.env.ACCESS_TOKEN ||'',{
        expiresIn:"5m",
    })

}

//refresh access token
userSchema.methods.SignRefreshToken = function (){
    return Jwt.sign({id:this._id},process.env.REFRESH_TOKEN ||'',{
        expiresIn:"7d",
    })
}


//compare Password

userSchema.methods.comparedPassword = async function(enteredPassword:string):Promise<boolean>{
    return await bcrypt.compare(enteredPassword, this.password)
};

const userModel: Model<IUser> = mongoose.model("User",userSchema)

export default userModel