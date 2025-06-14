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

import { mapValues } from '../runtime';
/**
 * 
 * @export
 * @interface OtpRequest
 */
export interface OtpRequest {
    /**
     * 
     * @type {string}
     * @memberof OtpRequest
     */
    tempOtpToken: string;
    /**
     * 
     * @type {string}
     * @memberof OtpRequest
     */
    otp: string;
}

/**
 * Check if a given object implements the OtpRequest interface.
 */
export function instanceOfOtpRequest(value: object): boolean {
    if (!('tempOtpToken' in value)) return false;
    if (!('otp' in value)) return false;
    return true;
}

export function OtpRequestFromJSON(json: any): OtpRequest {
    return OtpRequestFromJSONTyped(json, false);
}

export function OtpRequestFromJSONTyped(json: any, ignoreDiscriminator: boolean): OtpRequest {
    if (json == null) {
        return json;
    }
    return {
        
        'tempOtpToken': json['temp_otp_token'],
        'otp': json['otp'],
    };
}

export function OtpRequestToJSON(value?: OtpRequest | null): any {
    if (value == null) {
        return value;
    }
    return {
        
        'temp_otp_token': value['tempOtpToken'],
        'otp': value['otp'],
    };
}

