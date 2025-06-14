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


import * as runtime from '../runtime';
import type {
  UserSignupStats,
} from '../models/index';
import {
    UserSignupStatsFromJSON,
} from '../models/index';

/**
 * 
 */
export class DashboardApi extends runtime.BaseAPI {

    /**
     */
    async dashboardApiUserSignupsListRaw(initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<Array<UserSignupStats>>> {
        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        if (this.configuration && (this.configuration.username !== undefined || this.configuration.password !== undefined)) {
            headerParameters["Authorization"] = "Basic " + btoa(this.configuration.username + ":" + this.configuration.password);
        }
        if (this.configuration && this.configuration.accessToken) {
            const token = this.configuration.accessToken;
            const tokenString = await token("jwtAuth", []);

            if (tokenString) {
                headerParameters["Authorization"] = `Bearer ${tokenString}`;
            }
        }
        if (this.configuration && this.configuration.apiKey) {
            headerParameters["Authorization"] = await this.configuration.apiKey("Authorization"); // ApiKeyAuth authentication
        }

        const response = await this.request({
            path: `/dashboard/api/user-signups/`,
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response, (jsonValue) => jsonValue.map(UserSignupStatsFromJSON));
    }

    /**
     */
    async dashboardApiUserSignupsList(initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<Array<UserSignupStats>> {
        const response = await this.dashboardApiUserSignupsListRaw(initOverrides);
        return await response.value();
    }

}
