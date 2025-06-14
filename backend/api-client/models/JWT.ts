/* tslint:disable */
/* eslint-disable */
/**
 * Micro AI
 * Build Micro Apps with No Code
 *
 * The version of the OpenAPI document: 0.1.0
 * 
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */

import type { CustomUser } from './CustomUser';
import {
    CustomUserFromJSON,
    CustomUserToJSON,
} from './CustomUser';

/**
 * Serializer for JWT authentication.
 * @export
 * @interface JWT
 */
export interface JWT {
    /**
     * 
     * @type {string}
     * @memberof JWT
     */
    access: string;
    /**
     * 
     * @type {string}
     * @memberof JWT
     */
    refresh: string;
    /**
     * 
     * @type {CustomUser}
     * @memberof JWT
     */
    user: CustomUser;
    /**
     * Unix timestamp for when the access token expires
     * @type {number}
     * @memberof JWT
     */
    access_expiration?: number;
}

/**
 * Check if a given object implements the JWT interface.
 */
export function instanceOfJWT(value: object): boolean {
    if (!('access' in value)) return false;
    if (!('refresh' in value)) return false;
    if (!('user' in value)) return false;
    return true;
}

export function JWTFromJSON(json: any): JWT {
    return JWTFromJSONTyped(json, false);
}

export function JWTFromJSONTyped(json: any, ignoreDiscriminator: boolean): JWT {
    if (json == null) {
        return json;
    }
    return {
        
        'access': json['access'],
        'refresh': json['refresh'],
        'user': CustomUserFromJSON(json['user']),
        'access_expiration': json['access_expiration'],
    };
}

export function JWTToJSON(value?: JWT | null): any {
    if (value == null) {
        return value;
    }
    return {
        
        'access': value['access'],
        'refresh': value['refresh'],
        'user': CustomUserToJSON(value['user']),
        'access_expiration': value['access_expiration'],
    };
}

